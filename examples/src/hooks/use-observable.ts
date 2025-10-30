import { useEffect, useMemo, useRef, useState } from "react";
import { BehaviorSubject, Observable } from "rxjs";

/** Hook to subscribe to an RxJS Observable and get its current value */
export function useObservable<T>(observable: BehaviorSubject<T>): T;
export function useObservable<T>(observable: Observable<T>): T | undefined;
export function useObservable<T>(observable: Observable<T>): T | undefined {
  const sync = useRef<T>(Reflect.get(observable, "value"));

  // Keep value state to trigger re-renders
  const [_, setValue] = useState<T>(Reflect.get(observable, "value"));

  useEffect(() => {
    const sub = observable.subscribe((v) => {
      // Set ref so that sync values are supported
      sync.current = v;
      setValue(v);
    });

    return () => sub.unsubscribe();
  }, [observable]);

  return sync.current;
}

/** Subscribe to an observable with a creator function and dependencies */
export function useObservableMemo<T>(
  project: () => Observable<T>,
  deps: any[],
): T | undefined {
  const observable = useMemo(() => project(), deps);
  return useObservable(observable);
}
