import type { Component } from "vue";

export type NavItem<V extends string> = {
  id: V;
  label: string;
  icon: Component;
  accentIcon?: boolean;
};
