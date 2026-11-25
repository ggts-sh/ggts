/**
 * Compare the patched and fresh SVG trees without canonicalizing them (#1471).
 * Report the first mismatching node path when unequal.
 */
export function compareSvgDom(
  updated: Element | null,
  fresh: Element | null,
): { equal: boolean; detail: string } {
  const describe = (el: Element): string => {
    const attrs = Array.from(el.attributes)
      .map((at) => `${at.name}=${at.value}`)
      .join(" ");
    return `<${el.tagName} ${attrs}>`;
  };
  const firstDiff = (x: Node, y: Node, path: string): string | null => {
    if (x.nodeType !== y.nodeType) return `${path}: nodeType ${x.nodeType} vs ${y.nodeType}`;
    if (x instanceof Element && y instanceof Element) {
      if (x.tagName !== y.tagName) return `${path}: <${x.tagName}> vs <${y.tagName}>`;
      if (x.attributes.length !== y.attributes.length) {
        return `${path}: attr count ${describe(x)} vs ${describe(y)}`;
      }
      for (const at of Array.from(x.attributes)) {
        const other = y.getAttributeNS(at.namespaceURI, at.localName);
        if (other !== at.value) {
          return `${path}: ${at.name}="${at.value}" vs "${other}" (${describe(y)})`;
        }
      }
    }
    if (x.textContent !== y.textContent && x.childNodes.length === 0) {
      return `${path}: text "${x.textContent}" vs "${y.textContent}"`;
    }
    const xc = Array.from(x.childNodes);
    const yc = Array.from(y.childNodes);
    if (xc.length !== yc.length) {
      return `${path}: children ${xc.length} vs ${yc.length} (${describe(x as Element)})`;
    }
    for (let i = 0; i < xc.length; i++) {
      const d = firstDiff(xc[i]!, yc[i]!, `${path}/${xc[i]!.nodeName}[${i}]`);
      if (d !== null) return d;
    }
    return null;
  };

  if (updated === null || fresh === null) return { equal: false, detail: "no root element" };
  if (updated.isEqualNode(fresh))
    return { equal: true, detail: "patched DOM identical to fresh render" };
  return { equal: false, detail: firstDiff(updated, fresh, "svg") ?? "svg: differs" };
}
