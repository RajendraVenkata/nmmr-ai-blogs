'use client';

import { createContext, useContext, useState } from 'react';

interface SearchCtx {
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<SearchCtx>({
  query: '',
  setQuery: () => {},
  open: false,
  setOpen: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ query, setQuery, open, setOpen }}>{children}</Ctx.Provider>
  );
}

export function useSearch() {
  return useContext(Ctx);
}
