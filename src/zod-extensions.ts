import { ParameterObject, SchemaObject } from 'openapi3-ts';
import type { z } from 'zod';
import { isZodType } from './lib/zod-is-type';

export interface ZodOpenAPIMetadata<T = any> extends SchemaObject {
  refId?: string;
  extendedFrom?: string;
  param?: Partial<ParameterObject> & { example?: T };
  example?: T;
}

declare module 'zod' {
  interface ZodTypeDef {
    openapi?: ZodOpenAPIMetadata;
  }

  abstract class ZodSchema<Output, Def extends ZodTypeDef, Input = Output> {
    openapi<T extends ZodSchema<any>>(
      this: T,
      metadata: Partial<ZodOpenAPIMetadata<z.infer<T>>>
    ): T;
  }
}

export function extendZodWithOpenApi(zod: typeof z) {
  if (typeof zod.ZodSchema.prototype.openapi !== 'undefined') {
    // This zod instance is already extended with the required methods,
    // doing it again will just result in multiple wrapper methods for
    // `optional` and `nullable`
    return;
  }

  zod.ZodSchema.prototype.openapi = function (openapi) {
    const { param, ...restOfOpenApi } = openapi ?? {};

    const result = new (this as any).constructor({
      ...this._def,
      openapi: {
        ...this._def.openapi,
        ...restOfOpenApi,
        param: {
          ...this._def.openapi?.param,
          ...param,
        },
      },
    });

    if (isZodType(this, 'ZodObject')) {
      const initialExtend = this.extend;

      // TODO: This does an overload everytime. So .extend().openapi() makes this change twice
      result.extend = function (...args: any) {
        const extendedResult = initialExtend.apply(result, args);

        extendedResult._def.openapi = {
          extendedFrom: result._def.openapi?.refId,
        };

        return extendedResult;
      };
    }

    return result;
  };

  const zodOptional = zod.ZodSchema.prototype.optional as any;
  (zod.ZodSchema.prototype.optional as any) = function (
    this: any,
    ...args: any[]
  ) {
    const result = zodOptional.apply(this, args);

    result._def.openapi = this._def.openapi;

    return result;
  };

  const zodNullable = zod.ZodSchema.prototype.nullable as any;
  (zod.ZodSchema.prototype.nullable as any) = function (
    this: any,
    ...args: any[]
  ) {
    const result = zodNullable.apply(this, args);

    result._def.openapi = this._def.openapi;

    return result;
  };
}
