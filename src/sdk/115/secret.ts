import SparkMD5 from 'spark-md5'

const MODULUS = BigInt('0x8686980c0f5a24c4b9d43020cd2c22703ff3f450756529058b1cf88f09b8602136477198a6e2683149659bd122c33592fdb5ad47944ad1ea4d36c6b172aad6338c3bb6ac6227502d010993ac967d1aef00f0c8e038de2e4d3bc2ec368af2e9f10a6f1eda4f7262f136420c07c331b871bf139f74f3010e3c4fe57df3afb71683')
const EXPONENT = 0x10001n
const KTS = [240, 229, 105, 174, 191, 220, 191, 138, 26, 69, 232, 190, 125, 166, 115, 184, 222, 143, 231, 196, 69, 218, 134, 196, 155, 100, 139, 20, 106, 180, 241, 170, 56, 1, 53, 158, 38, 105, 44, 134, 0, 107, 79, 165, 54, 52, 98, 166, 42, 150, 104, 24, 242, 74, 253, 189, 107, 151, 143, 77, 143, 137, 19, 183, 108, 142, 147, 237, 14, 13, 72, 62, 215, 47, 136, 216, 254, 254, 126, 134, 80, 149, 79, 209, 235, 131, 38, 52, 219, 102, 123, 156, 126, 157, 122, 129, 50, 234, 182, 51, 222, 58, 169, 89, 52, 102, 59, 170, 186, 129, 96, 72, 185, 213, 129, 156, 248, 108, 132, 119, 255, 84, 120, 38, 95, 190, 232, 30, 54, 159, 52, 128, 92, 69, 44, 155, 118, 213, 27, 143, 204, 195, 184, 245]
const KEY_S = [0x29, 0x23, 0x21, 0x5e]
const KEY_L = [120, 6, 173, 76, 51, 134, 93, 24, 76, 1, 63, 70]

const bytes = (value: string) => Array.from(value, char => char.charCodeAt(0))
const text = (value: ArrayLike<number>) => Array.from({ length: value.length }, (_, i) => String.fromCharCode(value[i])).join('')
const hex = (value: ArrayLike<number>) => Array.from({ length: value.length }, (_, i) => value[i].toString(16).padStart(2, '0')).join('')
const fromHex = (value: string) => value.match(/../g)?.map(part => Number.parseInt(part, 16)) || []
const rsa = (value: bigint) => { let result = 1n; let base = value; let exponent = EXPONENT; while (exponent) { if (exponent & 1n) result = result * base % MODULUS; base = base * base % MODULUS; exponent >>= 1n } return result }
const xor115 = (src: number[], key: number[]) => {
  const remainder = src.length % 4
  return src.map((item, index) => item ^ key[index < remainder ? index : (index - remainder) % key.length])
}
const derivedKey = (length: number, key: number[] | null) => key
  ? Array.from({ length }, (_, i) => ((key[i] + KTS[length * i]) & 0xff) ^ KTS[length * (length - 1 - i)])
  : length === 12 ? KEY_L.slice() : KEY_S.slice()
const symmetricEncode = (src: number[], key: number[]) => xor115(xor115(src, derivedKey(4, key)).reverse(), derivedKey(12, null))
const symmetricDecode = (src: number[], key: number[], iv: number[]) => xor115(xor115(src, derivedKey(12, iv)).reverse(), derivedKey(4, key))
const asymmetricEncode = (src: number[]) => {
  const blockSize = 117
  const blocks: number[] = []
  for (let offset = 0; offset < src.length; offset += blockSize) {
    const block = src.slice(offset, offset + blockSize)
    const padded = [0, 2, ...Array(128 - block.length - 3).fill(255), 0, ...block]
    blocks.push(...fromHex(rsa(BigInt(`0x${hex(padded)}`)).toString(16).padStart(256, '0')))
  }
  return btoa(text(blocks))
}
const asymmetricDecode = (src: number[]) => {
  const result: number[] = []
  for (let offset = 0; offset < src.length; offset += 128) {
    const block = src.slice(offset, offset + 128)
    const decoded = fromHex(rsa(BigInt(`0x${hex(block)}`)).toString(16).padStart(256, '0'))
    let separator = 2
    while (separator < decoded.length && decoded[separator] !== 0) separator += 1
    result.push(...decoded.slice(separator + 1))
  }
  return result
}

export const secret = {
  encode(value: string, timestamp: number) {
    const key = bytes(SparkMD5.hash(`!@###@#${timestamp}DFDR@#@#`))
    const payload = symmetricEncode(bytes(value), key)
    return { data: asymmetricEncode([...key.slice(0, 16), ...payload]), key }
  },
  decode(value: string, key: number[]) {
    const raw = Array.from(atob(value), char => char.charCodeAt(0))
    const decoded = asymmetricDecode(raw)
    return text(symmetricDecode(decoded.slice(16), key, decoded.slice(0, 16)))
  },
}
