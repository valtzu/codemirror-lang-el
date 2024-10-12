import { NodeProp } from '@lezer/common';
import { ELScalar } from "./types";

// @ts-ignore
export const t: NodeProp<ELScalar> = {
  deserialize: (str: string): ELScalar => str as ELScalar,
};
