declare module 'sharp' {
  interface Sharp {
    png(): Sharp
    toBuffer(): Promise<Buffer>
  }
  function sharp(input: Buffer | string): Sharp
  export default sharp
}
