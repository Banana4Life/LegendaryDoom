function dragStart(e: DragEvent): void {
    if (e.target instanceof Element) {
        e.target.classList.add('drag-hover')
    }
}

function dragEnd(e: DragEvent): void {
    if (e.target instanceof Element) {
        e.target.classList.remove('drag-hover')
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
                game.doomGame = DoomGame.parse(wad)
                game.audio.playMusic("D_E1M1");
                console.log(game.doomGame.maps.length)
            })
        }
    })
})

function main() {
    game.init()
}

window.onload = main