import { Expression } from './expression';
import { NewExpression } from './expressions';
import { Scope } from './scope';
import { ThingSymbol } from './symbol';
import { TypeDeclaration } from './type-declaration';

export enum PrimitiveType {
  /**
   * A JSON date (represented as it's ISO-8601 string form).
   */
  Date = 'date',
  /**
   * A plain string.
   */
  String = 'string',
  /**
   * A number (integer or float).
   */
  Number = 'number',
  /**
   * A boolean value.
   */
  Boolean = 'boolean',
  /**
   * The value "Undefined"
   */
  Undefined = 'undefined',
  /**
   * A JSON object
   */
  Json = 'json',
  /**
   * Value with "any" or "unknown" type (aka Object). Values typed `any` may
   * be `null` or `undefined`.
   */
  Any = 'any',

  /**
   * No type
   */
  Void = 'void',
}

export type TypeReferenceSpec =
  | { readonly fqn: string; readonly genericArguments?: Type[] }
  | { readonly primitive: PrimitiveType }
  | { readonly collection: { readonly kind: 'map' | 'array'; readonly elementType: Type } }
  | { readonly union: Type[] };

/**
 * A reference to an existing type in the given scope
 */
export class Type {
  public static readonly ANY = new Type({ primitive: PrimitiveType.Any });
  public static readonly VOID = new Type({ primitive: PrimitiveType.Void });
  public static readonly STRING = new Type({ primitive: PrimitiveType.String });
  public static readonly NUMBER = new Type({ primitive: PrimitiveType.Number });
  public static readonly BOOLEAN = new Type({ primitive: PrimitiveType.Boolean });
  public static readonly UNDEFINED = new Type({ primitive: PrimitiveType.Undefined });

  public static fromName(scope: Scope, name: string, genericArguments?: Type[]) {
    return new Type({ fqn: name, genericArguments }, scope, new ThingSymbol(name, scope));
  }

  public static arrayOf(elementType: Type) {
    return new Type({ collection: { kind: 'array', elementType } });
  }

  public static mapOf(elementType: Type) {
    return new Type({ collection: { kind: 'map', elementType } });
  }

  public static unionOf(...types: Type[]) {
    return new Type({ union: types });
  }

  public readonly spec: TypeReferenceSpec;

  private constructor(spec?: TypeReferenceSpec, public readonly scope?: Scope, public readonly symbol?: ThingSymbol) {
    this.spec = spec ?? { primitive: PrimitiveType.Void };

    if (isFqnSpec(this.spec) && !scope) {
      throw new Error(`FQN types must have a scope`);
    }
  }

  public toString(): string {
    if (this.isVoid) {
      return 'void';
    }
    if (this.primitive) {
      return this.primitive;
    }
    if (this.fqn) {
      return this.fqn;
    }

    if (this.arrayOfType) {
      return `Array<${this.arrayOfType.toString()}>`;
    }
    if (this.mapOfType) {
      return `Map<string => ${this.mapOfType.toString()}>`;
    }
    if (this.unionOfTypes) {
      return this.unionOfTypes.map((x) => x.toString()).join(' | ');
    }

    throw new Error(`Unknown type reference: ${JSON.stringify(this.spec)}`);
  }

  public get fqn(): string | undefined {
    return this.spec && isFqnSpec(this.spec) ? this.spec.fqn : undefined;
  }

  public get isVoid(): boolean {
    return !this.spec;
  }

  public get isAny(): boolean {
    return this.primitive === PrimitiveType.Any;
  }

  public get primitive(): PrimitiveType | undefined {
    return isPrimitiveSpec(this.spec) ? this.spec.primitive : undefined;
  }

  public get declaration(): TypeDeclaration | undefined {
    return isFqnSpec(this.spec) ? this.scope?.tryFindType(this.spec.fqn) : undefined;
  }

  public get arrayOfType(): Type | undefined {
    return isCollectionSpec(this.spec) && this.spec.collection.kind === 'array'
      ? this.spec.collection.elementType
      : undefined;
  }

  public get mapOfType(): Type | undefined {
    return isCollectionSpec(this.spec) && this.spec.collection.kind === 'map'
      ? this.spec.collection.elementType
      : undefined;
  }

  public get unionOfTypes(): Type[] | undefined {
    return isUnionSpec(this.spec) ? this.spec.union : undefined;
  }

  public get genericArguments(): Type[] | undefined {
    return isFqnSpec(this.spec) ? this.spec.genericArguments ?? [] : [];
  }

  public withGenericArguments(...genericArguments: Type[]): Type {
    if (!isFqnSpec(this.spec)) {
      throw new Error('withGenericArguments: currently only supported for user-defined types!');
    }
    return new Type({ fqn: this.spec.fqn, genericArguments }, this.scope, this.symbol);
  }

  public newInstance(...args: Expression[]) {
    return new NewExpression(this, ...args);
  }

  public optional() {
    return Type.unionOf(this, Type.UNDEFINED);
  }
}

function isFqnSpec(x: TypeReferenceSpec): x is Extract<TypeReferenceSpec, { fqn: string }> {
  return !!(x as any).fqn;
}

function isPrimitiveSpec(x: TypeReferenceSpec): x is Extract<TypeReferenceSpec, { primitive: PrimitiveType }> {
  return !!(x as any).primitive;
}

function isCollectionSpec(
  x: TypeReferenceSpec,
): x is Extract<TypeReferenceSpec, { collection: { kind: 'map' | 'array'; elementType: Type } }> {
  return !!(x as any).collection;
}

function isUnionSpec(x: TypeReferenceSpec): x is Extract<TypeReferenceSpec, { union: Type[] }> {
  return !!(x as any).union;
}