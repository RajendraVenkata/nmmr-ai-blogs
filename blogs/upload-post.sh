#!/usr/bin/env bash
#
# Publish a markdown blog post (YAML-ish frontmatter + body) to an NMMR AI Blogs
# backend: cover image -> S3 media bucket, post record -> DynamoDB.
#
# Usage:
#   ./upload-post.sh [options] <post.md>
#
# Options:
#   -f, --file FILE         Markdown file (or pass as positional arg)
#   -c, --cover FILE        Cover image (default: 'cover:' from frontmatter,
#                           resolved relative to the markdown file)
#   -r, --region REGION     AWS region                 (env REGION, default ap-south-1)
#   -t, --table TABLE       DynamoDB Post table         (env TABLE)
#   -b, --bucket BUCKET     S3 media bucket             (env BUCKET)
#       --author-name NAME  Author display name         (env AUTHOR_NAME)
#       --author-id ID      Author id                   (env AUTHOR_ID)
#       --id POST_ID        Reuse to UPDATE an existing post (default: new uuid)
#       --site-url URL      Base URL for the printed link (env SITE_URL)
#       --discover          Auto-discover TABLE and BUCKET in the region
#   -y, --yes               Skip the confirmation prompt (env FORCE=1)
#   -n, --dry-run           Build the item + show the plan, but make no AWS calls
#   -h, --help              Show this help
#
# Precedence for each setting: flag > environment variable > built-in default.
#
set -euo pipefail

# ---- defaults (env overridable) ----
REGION="${REGION:-ap-south-1}"
TABLE="${TABLE:-Post-ay2q5auaibha7ptbkh7ejqeo34-NONE}"
BUCKET="${BUCKET:-amplify-d343i0k2u8raax-ma-mnnrblogmediabucket30fe5-qxzinij66qoi}"
AUTHOR_NAME="${AUTHOR_NAME:-Rajendra Venkata}"
AUTHOR_ID="${AUTHOR_ID:-rajendra.venkata@gmail.com}"
SITE_URL="${SITE_URL:-https://www.rajendravenkata.com}"
POST_ID="${POST_ID:-}"
COVER_OVERRIDE=""
MD_FILE=""
DISCOVER=0
DRY_RUN=0
ASSUME_YES="${FORCE:-0}"; [[ "$ASSUME_YES" == "1" ]] && ASSUME_YES=1 || ASSUME_YES=0

usage() { sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# ---- arg parsing ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)        MD_FILE="$2"; shift 2 ;;
    -c|--cover)       COVER_OVERRIDE="$2"; shift 2 ;;
    -r|--region)      REGION="$2"; shift 2 ;;
    -t|--table)       TABLE="$2"; shift 2 ;;
    -b|--bucket)      BUCKET="$2"; shift 2 ;;
    --author-name)    AUTHOR_NAME="$2"; shift 2 ;;
    --author-id)      AUTHOR_ID="$2"; shift 2 ;;
    --id)             POST_ID="$2"; shift 2 ;;
    --site-url)       SITE_URL="$2"; shift 2 ;;
    --discover)       DISCOVER=1; shift ;;
    -y|--yes)         ASSUME_YES=1; shift ;;
    -n|--dry-run)     DRY_RUN=1; shift ;;
    -h|--help)        usage 0 ;;
    -*)               echo "Unknown option: $1" >&2; usage 1 ;;
    *)                MD_FILE="$1"; shift ;;
  esac
done

[[ -n "$MD_FILE" ]] || { echo "ERROR: no markdown file given." >&2; usage 1; }
[[ -f "$MD_FILE" ]] || { echo "ERROR: markdown file not found: $MD_FILE" >&2; exit 1; }
command -v aws >/dev/null     || { echo "ERROR: aws CLI not found" >&2; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found" >&2; exit 1; }

MD_DIR="$(cd "$(dirname "$MD_FILE")" && pwd)"

# ---- optional auto-discovery of TABLE / BUCKET ----
discover_one() {  # $1=human label  $2=newline-separated candidates
  local label="$1" cands="$2" n
  n="$(printf '%s\n' "$cands" | grep -c . || true)"
  if [[ "$n" -eq 0 ]]; then
    echo "ERROR: could not auto-discover a $label in region $REGION." >&2; exit 1
  elif [[ "$n" -gt 1 ]]; then
    echo "ERROR: multiple $label candidates — pass one explicitly:" >&2
    printf '  %s\n' $cands >&2; exit 1
  fi
  printf '%s\n' "$cands"
}
if [[ "$DISCOVER" -eq 1 ]]; then
  echo "Discovering resources in $REGION ..."
  TABLE="$(discover_one 'Post table' \
    "$(aws dynamodb list-tables --region "$REGION" \
        --query 'TableNames' --output text | tr '\t' '\n' | grep '^Post-' || true)")"
  BUCKET="$(discover_one 'media bucket' \
    "$(aws s3api list-buckets \
        --query 'Buckets[].Name' --output text | tr '\t' '\n' | grep 'mnnrblogmedia' || true)")"
fi

# ---- parse frontmatter + body, build the DynamoDB item JSON ----
ITEM_JSON="$(mktemp -t post-item-XXXXXX.json)"
trap 'rm -f "$ITEM_JSON"' EXIT

eval "$(POST_ID="$POST_ID" AUTHOR_NAME="$AUTHOR_NAME" AUTHOR_ID="$AUTHOR_ID" \
        MD_DIR="$MD_DIR" COVER_OVERRIDE="$COVER_OVERRIDE" \
        python3 - "$MD_FILE" "$ITEM_JSON" <<'PY'
import sys, os, re, json, uuid, datetime

md_file, out_path = sys.argv[1], sys.argv[2]
raw = open(md_file, encoding="utf-8").read()

m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.S)
if not m:
    sys.exit("ERROR: file must start with a --- frontmatter block ---")
fm_text, body = m.group(1), m.group(2).strip()

fm = {}
for line in fm_text.splitlines():
    s = line.strip()
    if not s or s.startswith("#"):
        continue
    k, _, v = line.partition(":")
    k, v = k.strip(), v.strip()
    if v.startswith("["):
        fm[k] = json.loads(v)
    else:
        fm[k] = v.strip().strip('"').strip("'")

for req in ("title", "slug"):
    if not fm.get(req):
        sys.exit(f"ERROR: frontmatter missing required key: {req}")

title   = fm["title"]
slug    = fm["slug"]
excerpt = fm.get("excerpt", "")
tags    = fm.get("tags", []) or []

cover_override = os.environ.get("COVER_OVERRIDE", "")
if cover_override:
    cover_file = cover_override
    cover_name = os.path.basename(cover_override)
else:
    cover_name = os.path.basename(fm.get("cover", ""))
    cover_file = os.path.join(os.environ["MD_DIR"], cover_name) if cover_name else ""
cover_key = f"media/{cover_name}" if cover_name else ""

post_id = os.environ.get("POST_ID") or str(uuid.uuid4())
now = datetime.datetime.now(datetime.timezone.utc)
iso = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

item = {
    "id":           {"S": post_id},
    "slug":         {"S": slug},
    "title":        {"S": title},
    "bodyMarkdown": {"S": body},
    "status":       {"S": "PUBLISHED"},
    "authorId":     {"S": os.environ["AUTHOR_ID"]},
    "authorName":   {"S": os.environ["AUTHOR_NAME"]},
    "publishedAt":  {"S": iso},
    "createdAt":    {"S": iso},
    "updatedAt":    {"S": iso},
    "__typename":   {"S": "Post"},
}
if excerpt:
    item["excerpt"] = {"S": excerpt}
if cover_key:
    item["coverImageKey"] = {"S": cover_key}
if tags:
    item["tags"] = {"L": [{"S": str(t)} for t in tags]}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(item, f, ensure_ascii=False)

def sh(v):
    return "'" + str(v).replace("'", "'\\''") + "'"

print(f"SLUG={sh(slug)}")
print(f"TITLE={sh(title)}")
print(f"POST_ID={sh(post_id)}")
print(f"COVER_FILE={sh(cover_file)}")
print(f"COVER_KEY={sh(cover_key)}")
PY
)"

# ---- plan ----
echo "About to publish:"
echo "  Title:      $TITLE"
echo "  Slug:       $SLUG"
echo "  Post ID:    $POST_ID"
echo "  Cover:      ${COVER_FILE:-<none>}  ->  s3://$BUCKET/${COVER_KEY:-<none>}"
echo "  Table:      $TABLE  (region $REGION)"
echo "  Live URL:   $SITE_URL/posts/$SLUG"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] item JSON written to: $ITEM_JSON"
  cp "$ITEM_JSON" "${ITEM_JSON}.keep" && echo "[dry-run] copy kept at: ${ITEM_JSON}.keep"
  echo "[dry-run] no AWS calls made."
  exit 0
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Proceed? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "Aborted."; exit 1; }
fi

# 1) Upload cover image (raster -> renders large on LinkedIn; embedded by /og route).
if [[ -n "${COVER_KEY:-}" ]]; then
  [[ -f "$COVER_FILE" ]] || { echo "ERROR: cover file not found: $COVER_FILE" >&2; exit 1; }
  case "$COVER_FILE" in
    *.png)       CT=image/png ;;
    *.jpg|*.jpeg) CT=image/jpeg ;;
    *.webp)      CT=image/webp ;;
    *.gif)       CT=image/gif ;;
    *)           CT=application/octet-stream ;;
  esac
  echo "Uploading cover -> s3://$BUCKET/$COVER_KEY ($CT)"
  aws s3 cp "$COVER_FILE" "s3://$BUCKET/$COVER_KEY" --content-type "$CT" --region "$REGION"
fi

# 2) Write the post record to DynamoDB.
echo "Writing post record to $TABLE"
aws dynamodb put-item --region "$REGION" --table-name "$TABLE" --item "file://$ITEM_JSON"

echo
echo "Done. Published: $SITE_URL/posts/$SLUG"
echo "If the page 404s briefly, it's CDN/cache — give it a moment."
echo "Tip: refresh the LinkedIn preview at https://www.linkedin.com/post-inspector/"
