import examples from "../examples";
import { useState, useMemo } from "react";
import useHash from "../hooks/use-hash";

export default function SideNav() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const hash = useHash();

  const filtered = useMemo(
    () =>
      examples.filter((item) =>
        item.id.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );

  return (
    <div className="drawer-side">
      <label
        htmlFor="drawer"
        aria-label="open sidebar"
        className="drawer-overlay"
      ></label>
      <div className="menu bg-base-200 text-base-content min-h-full">
        <input
          type="text"
          placeholder="Search..."
          className="input input-bordered w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <ul className="menu menu-lg px-0 font-mono w-xs">
          {filtered.map((item) => (
            <li key={item.id}>
              <a
                href={"#" + item.id}
                className={
                  "text-sm " + (hash === "#" + item.id ? "menu-active" : "")
                }
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
