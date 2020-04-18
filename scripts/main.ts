function dragStart(e: DragEvent): void {
    if (e.target instanceof Element) {
        e.target.classList.add('drag-hover')
    }
}
function dragEnd(e: DragEvent): void {
    if (e.target instanceof Element) {
        e.target.classList.add('drag-hover')
    }
}

document.querySelectorAll('.drop-target').forEach(elem => {
    elem.addEventListener('dragenter', (e: DragEvent) => {
        e.preventDefault()
        dragStart(e)
    })
    elem.addEventListener('dragleave', (e: DragEvent) => {
        dragEnd(e)
    })

    elem.addEventListener('dragover', e => {
        e.preventDefault()
    })

    elem.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        dragEnd(e)
        if (e.dataTransfer.files.length > 0) {
            let possibleWad = e.dataTransfer.files.item(0)
            if (possibleWad.type == "application/x-doom-wad") {
                possibleWad.arrayBuffer().then(buf => {
                    let reader = readString("ASCII")
                    let memory = new Uint8Array(buf)
                    console.log(reader(memory, 0, 4), readU32LE(memory, 4), buf.byteLength)
                })
            }
        }
    })
})

function callback(canvas, gl, shaders) {
    render(gl, shaders);
}

function main() {
    initCanvas(callback)
}

window.onload = main;