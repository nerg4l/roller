
export const sideRotation = (i: number, sides: number) => {
    return [0, ((Math.PI * 2 * i) / sides), (i % 2 ? 1 : 0) * Math.PI]
}
