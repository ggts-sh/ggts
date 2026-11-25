/**
 * DOM/canvas snapshot helpers for the harness verification gates. These are
 * parity-sensitive: changes here can flip mutation/fresh-equality verdicts,
 * so edits must be deliberate, never incidental.
 */

export type UpdateVerification = {
  equal: boolean;
  detail: string;
  mutated: boolean;
};

function hasZeroOpacity(el: Element): boolean {
  return /(?:^|;)\s*opacity\s*:\s*0(?:\s*;|\s*$)/.test(el.getAttribute("style") ?? "");
}

function needsNormalization(root: HTMLElement): boolean {
  if (root.querySelector("[id], canvas") !== null) return true;
  for (const el of root.querySelectorAll("[style]")) {
    if (hasZeroOpacity(el)) return true;
  }
  return false;
}

export function canonicalDom(root: HTMLElement): string {
  if (!needsNormalization(root)) return root.innerHTML;
  const clone = root.cloneNode(true) as HTMLElement;
  // Transition helpers can retain stale geometry in zero-opacity exit nodes.
  // They are not visible output and must not make mutation/fresh parity fail.
  for (const el of clone.querySelectorAll<HTMLElement | SVGElement>("[style]")) {
    if (hasZeroOpacity(el)) el.remove();
  }
  const ids = new Map<string, string>();
  let nextId = 0;
  for (const el of clone.querySelectorAll("[id]")) {
    const id = el.getAttribute("id");
    if (id !== null) ids.set(id, `__id_${nextId++}__`);
  }
  // Replace longer ids first so `#foo` cannot corrupt a `#foobar` reference.
  const idReplacements = [...ids].sort(([left], [right]) => right.length - left.length);
  for (const el of clone.querySelectorAll("*")) {
    for (const attr of Array.from(el.attributes)) {
      let value = attr.value;
      const isAriaIdList = attr.name === "aria-labelledby" || attr.name === "aria-describedby";
      if (!isAriaIdList && attr.name !== "id" && !value.includes("#")) continue;
      for (const [id, replacement] of idReplacements) {
        if (attr.name === "id" && value === id) value = replacement;
        value = value.replaceAll(`url(#${id})`, `url(#${replacement})`);
        // Unovis embeds the document URL before the fragment in clip-path
        // styles (`url(http://host/page#generated-id)`). Normalize that form
        // as well as local `url(#generated-id)` references.
        value = value.replaceAll(`#${id}`, `#${replacement}`);
        if ((attr.localName === "href" || attr.name.startsWith("aria-")) && value === `#${id}`) {
          value = `#${replacement}`;
        }
        if (isAriaIdList) {
          value = value
            .split(/\s+/)
            .map((token) => (token === id ? replacement : token))
            .join(" ");
        }
      }
      if (value !== attr.value) el.setAttributeNS(attr.namespaceURI, attr.name, value);
    }
  }
  for (const canvas of clone.querySelectorAll("canvas")) canvas.textContent = "";
  return clone.innerHTML;
}

export function canvasPixelHash(root: HTMLElement): string {
  let hash = 0x811c9dc5;
  let count = 0;
  for (const canvas of root.querySelectorAll("canvas")) {
    const context = canvas.getContext("2d");
    if (context === null) continue;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    count += 1;
    for (const byte of pixels) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return `${count}:${(hash >>> 0).toString(16)}`;
}

export function visibleSnapshot(root: HTMLElement): string {
  const canvas = canvasPixelHash(root);
  return canvas.startsWith("0:") ? canonicalDom(root) : `canvas:${canvas}`;
}

/** Offscreen fixed-size root used by the verification gates so mounts render
 * with realistic layout without appearing in the harness viewport. */
export function verificationRoot(): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:500px;visibility:hidden";
  document.body.appendChild(root);
  return root;
}
