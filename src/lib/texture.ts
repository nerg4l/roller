import * as THREE from "three";

export const createTextTexture = (numbers: string[], size: number) => {
    let c = document.createElement('canvas')
    c.width = size * numbers.length
    c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) {
        return
    }
    ctx.fillStyle = '#c0c'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.font = '128px Creepster'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0f0'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < numbers.length; i++) {
        ctx.fillText(numbers[i], size * 0.5 + size * i, size * 0.5)
        if (numbers[i] === '6' || numbers[i] === '9') {
            ctx.fillText('_', size * 0.5 + size * i, size * 0.6)
        }
    }

    let texture = new THREE.CanvasTexture(c)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}
