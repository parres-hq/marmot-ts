import {
  createEffect,
  createSignal,
  ErrorBoundary,
  Show,
  type Component,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import SideNav from "./components/Nav";

import { CodeIcon } from "./components/items.tsx";
import examples, { type Example } from "./examples";
import useHash from "./hooks/use-hash";

function ExampleView(props: { example?: Example }) {
  const [path, setPath] = createSignal("");
  const [Component, setComponent] = createSignal<Component<any> | null>(null);

  // load selected example
  createEffect(() => {
    if (!props.example) return;
    setPath(props.example.path.replace(/^\.\//, ""));
    props.example
      .load()
      .then((module: any) => {
        if (typeof module.default !== "function")
          throw new Error("Example must be a function");

        console.log("Loaded Example", module.default);
        setComponent(() => module.default);
      })
      .catch((error) => {
        console.error("Failed to load example:", error);
        setComponent(null);
      });
  });

  return (
    <div class="drawer lg:drawer-open h-full min-h-screen">
      <input id="drawer" type="checkbox" class="drawer-toggle" />

      {/* Main content */}
      <div class="drawer-content flex flex-col relative">
        {/* Navbar */}
        <div class="navbar bg-base-300 w-full">
          <div class="flex-none lg:hidden">
            <label
              for="drawer"
              aria-label="open sidebar"
              class="btn btn-square btn-ghost"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="inline-block h-6 w-6 stroke-current"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </label>
          </div>
          <div class="mx-2 flex-1 px-2">
            <span class="font-bold text-lg">
              {props.example?.name ?? "Examples"}
            </span>
          </div>
          <div class="flex-none">
            <a
              target="_blank"
              class="btn btn-sm btn-ghost"
              href={`https://github.com/parres-hq/marmot-ts/tree/master/examples/src/${path()}`}
            >
              <CodeIcon /> Source
            </a>
          </div>
        </div>

        {/* Page content */}
        <Show
          when={Component()}
          fallback={
            <div class="flex justify-center items-center h-full">
              <span class="loading loading-dots loading-xl"></span>
            </div>
          }
        >
          {(component) => (
            <ErrorBoundary
              fallback={(error) => (
                <div class="text-red-500">{error.message}</div>
              )}
            >
              <Dynamic component={component()} />
            </ErrorBoundary>
          )}
        </Show>
      </div>

      {/* Sidebar */}
      <SideNav />
    </div>
  );
}

function App() {
  const [example, setExample] = createSignal<Example | null>(null);
  const hash = useHash();

  // set example based on hash or fallback to a random example
  createEffect(() => {
    const name = hash().replace(/^#/, "");
    const example = examples.find((e) => e.id === name);
    if (example) setExample(example);
    else setExample(examples[Math.floor(Math.random() * examples.length)]);
  });

  return <ExampleView example={example() ?? undefined} />;
}

export default App;
