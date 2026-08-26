import { createContext, useContext } from "react";

export type RKSearchContextValue = {
  search: string;
  setSearch: (v: string) => void;
};

export const RKSearchContext = createContext<RKSearchContextValue>({
  search: "",
  setSearch: () => {},
});

export const useRKSearch = () => useContext(RKSearchContext);
