import type { ActiveSegment, SegmentKey, SlabRecord } from "./slabs.js";
import type { TreeSnapshot } from "../persistent/snapshot.js";

// Build traces capture slab snapshots directly because tree visualization replays them verbatim.
export interface SlabBuildTraceStep {
  readonly kind: "slab-built";
  readonly slab: SlabRecord;
  readonly enteredEdgeIds: number[];
  readonly leftEdgeIds: number[];
  readonly activeEdgeIds: number[];
  readonly snapshot: TreeSnapshot<ActiveSegment, SegmentKey> | null;
}

// Query traces remain semantic (coordinates, versions, ids) and avoid UI-specific wording.
// The visualizer adapter is responsible for deriving labels/text from these fields.
export interface SlabSearchTraceStep {
  readonly kind: "slab-search-step";
  readonly queryX: number;
  readonly comparedSlabStart: number;
  readonly comparedSlabEnd: number;
  readonly direction: "left" | "right";
  readonly candidateSlabStart: number | null;
}

export interface BandBinarySearchTraceStep {
  readonly kind: "band-search-step";
  readonly slabVersion: number;
  readonly segmentEdgeId: number;
  readonly queryX: number;
  readonly queryY: number;
  readonly segmentY: number;
  readonly candidateEdgeId: number | null;
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
      readonly slabVersion: number;
    }
  | BandBinarySearchTraceStep
  | {
      readonly kind: "band-selected";
      readonly pointName: string;
      readonly slabVersion: number;
      readonly segmentEdgeId: number | null;
    }
  | {
      readonly kind: "face-resolved";
      readonly pointName: string;
      readonly slabVersion: number | null;
      readonly faceId: number | null;
      readonly classification: "inside" | "outer" | "boundary";
    };
