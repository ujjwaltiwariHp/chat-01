import { ApiError } from '@hp-intelligence/core';

export const formatVector = (values: number[]): string => {
  if (!values.length) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Embedding cannot be empty');
  }

  return '[' + values
    .map((value) => (Number.isFinite(value) ? value.toFixed(8) : '0'))
    .join(',') + ']';
};

export const assertVectorDimensions = (values: number[], expected: number): number[] => {
  if (values.length !== expected) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Embedding dimensions do not match VECTOR_DIMENSIONS');
  }

  return values;
};
