import { useEffect, useLayoutEffect } from "react";

export const useHostLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
