// Vue twin of the React shadcn components' `useBoundProp` + `useState` pair:
// bound (`bindings[prop]` set) reads the resolved prop and writes the state path;
// unbound keeps a local ref. `bound` is the fallback React used while bound.
import { computed, ref, type Ref } from "vue";
import { useFieldValidation, useStateStore } from "@json-render/vue";

export function useBound<T>(value: () => T | null | undefined, path: () => string | undefined, local: T, bound: () => T) {
  const { set } = useStateStore();
  const localRef = ref(local) as Ref<T>;
  return computed<T>({
    get: () => (path() ? (value() ?? bound()) : localRef.value),
    set: (v) => {
      const p = path();
      if (p) set(p, v);
      else localRef.value = v;
    },
  });
}

// ponytail: checks/validateOn are read once at setup (React re-read per render);
// specs set them in the same patch as the element, so they never change after mount.
export function useFieldCheck(path: string | undefined, checks: unknown[] | null | undefined, validateOn: string) {
  const has = !!(path && checks?.length);
  const { errors, validate } = useFieldValidation(path ?? "", has ? ({ checks: checks ?? [], validateOn } as never) : undefined);
  return { errors, has, validate, validateOn };
}
