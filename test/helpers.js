import { mapOverObj } from "fp-rosetree"

function isFunction(obj){
  return typeof obj === 'function'
}
function isPOJO(obj) {
  const proto = Object.prototype;
  const gpo = Object.getPrototypeOf;

  if (obj === null || typeof obj !== "object") {
    return false;
  }
  return gpo(obj) === proto;
}

export function formatResult(result) {
  if (!isPOJO(result)) {
    return result
  }
  else {
    return mapOverObj({key : x=>x, leafValue : prop => isFunction(prop) ? (prop.name || 'anonymous'): prop}, result)
  }
}
