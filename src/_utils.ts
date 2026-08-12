/**
 * @module rue.utils
 * @author Surmon <https://github.com/surmon-china>
 */

export type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
