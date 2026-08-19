import { describe, expect, it } from "vitest";
import {
  checkOutline,
  checkTraceResult,
  isAxisAlignedRectangle,
  isSelfIntersecting,
} from "./roof-outline";

/** A believable traced roof: rotated, 6 corners, no repeats. */
const realOutline = [
  [-80.1000, 26.2000],
  [-80.0994, 26.2003],
  [-80.0990, 26.1999],
  [-80.0993, 26.1995],
  [-80.0997, 26.1993],
  [-80.1001, 26.1996],
];

describe("roof outline invariants", () => {
  it("accepts one clean outline per structure", () => {
    expect(checkOutline(realOutline).ok).toBe(true);
    expect(checkTraceResult([{ rings: [realOutline] }]).ok).toBe(true);
  });

  it("fails when a structure returns more than one polygon", () => {
    const result = checkTraceResult([{ rings: [realOutline, realOutline] }]);
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("multiple_polygons");
  });

  it("fails on duplicate vertices stacked on the same point", () => {
    const dup = [...realOutline.slice(0, 3), [...realOutline[1]], ...realOutline.slice(3)];
    expect(checkOutline(dup).problems).toContain("duplicate_vertex");
  });

  it("fails on a self-intersecting polygon", () => {
    const bowtie = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ];
    expect(isSelfIntersecting(bowtie)).toBe(true);
    expect(checkOutline(bowtie).problems).toContain("self_intersecting");
  });

  it("fails on a 4-point axis-aligned rectangle", () => {
    const box = [
      [-80.1, 26.2],
      [-80.099, 26.2],
      [-80.099, 26.199],
      [-80.1, 26.199],
    ];
    expect(isAxisAlignedRectangle(box)).toBe(true);
    expect(checkOutline(box).problems).toContain("axis_aligned_rectangle");
  });

  it("allows a rotated four-corner roof", () => {
    const rotated = [
      [-80.1000, 26.2000],
      [-80.0992, 26.2004],
      [-80.0988, 26.1997],
      [-80.0996, 26.1993],
    ];
    expect(checkOutline(rotated).ok).toBe(true);
  });
});
