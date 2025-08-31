import { NodeProp } from '@lezer/common';
import { ELScalar } from "./types";

// @ts-expect-error TS2739
export const t: NodeProp<ELScalar> = {
  deserialize: (str: string): ELScalar => str as ELScalar,
};
