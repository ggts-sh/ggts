import { mount } from "svelte";

import App from "./App.svelte";

const target = document.querySelector("#app");
if (!(target instanceof HTMLElement)) throw new Error("missing #app");
mount(App, { target });
