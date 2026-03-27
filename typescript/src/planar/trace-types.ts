import type { ActiveSegment, SegmentKey, SlabRecord } from "./slabs.js";
import type { TreeSnapshot } from "../persistent/snapshot.js";

export interface SlabBuildTraceStep {
  readonly kind: "slab-built";
  readonly slab: SlabRecord;
  readonly enteredEdgeIds: number[];
  readonly leftEdgeIds: number[];
  readonly activeEdgeIds: number[];
  readonly snapshot: TreeSnapshot<ActiveSegment, SegmentKey> | null;
}

export interface SlabSearchTraceStep {
  readonly kind: "slab-search-step";
  readonly queryX: number;
  readonly comparedSlabName: string;
  readonly comparedStart: number;
  readonly direction: "left" | "right";
  readonly candidateSlabName: string | null;
  readonly candidateSlabStart: number | null;
}

export interface BandBinarySearchTraceStep {
  readonly kind: "band-search-step";
  readonly slabName: string;
  readonly low: number;
  readonly high: number;
  readonly mid: number;
  readonly segmentEdgeId: number;
  readonly queryX: number;
  readonly queryY: number;
  readonly segmentY: number;
  readonly direction: "lower" | "higher";
}

export type QueryTraceEvent =
  | {
      readonly kind: "boundary-check";
      readonly pointName: string;
      readonly isBoundary: boolean;
    }
  | SlabSearchTraceStep
  | {
      readonly kind: "slab-selected";
      readonly pointName: string;
      readonly slabName: string;
      readonly slabVersion: number;
    }
  | BandBinarySearchTraceStep
  | {
      readonly kind: "band-selected";
      readonly pointName: string;
      readonly slabName: string;
      readonly bandIndex: number;
      readonly segmentEdgeId: number | null;
    }
  | {
      readonly kind: "face-resolved";
      readonly pointName: string;
      readonly slabName: string;
      readonly faceId: number | null;
      readonly faceName: string;
      readonly classification: "inside" | "outer" | "boundary";
    };
