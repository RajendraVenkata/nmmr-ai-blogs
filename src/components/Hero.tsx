import Link from 'next/link';

export default function Hero() {
  return (
    <section className="py-16 text-center">
      <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        Hands-on insights on AI and engineering
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
        Practical articles from people building real systems.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/register" className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primaryDark">
          Get Started
        </Link>
        <Link href="#articles" className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50">
          Read the blog
        </Link>
      </div>
    </section>
  );
}
