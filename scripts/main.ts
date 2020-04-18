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
            parseWad(e.dataTransfer.files.item(0)).then(wad => {
                console.log(wad.header.type, wad.header.lumpCount, wad.dictionary.length)
            })
        }
    })
})

document.querySelectorAll("canvas").forEach(elem => {
    elem.addEventListener("click", e => {
        if (e.target instanceof Element) {
            controls.lockPointer(e.target)
        }
    })
})

function startLoop() {
    this.updateLoop(window, 0, update)
}

function updateLoop(root, pt, callback) {
    root.requestAnimationFrame(t => {
        let dt = 0;
        if (pt !== 0) {
            dt = (t - pt) / 1000;
        }
        if (callback(dt) === false) {
            return;
        }
        updateLoop(root, t, callback);
    });
}

let renderer = new Renderer();

function update(dt) {
    // TODO game logic

    renderer.render(dt);
}

function main() {
    controls.init(0, 0)
    renderer.initRenderer().then(startLoop)
}

window.onload = main;