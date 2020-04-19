

function awaitUserContent(): Promise<File> {

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

    console.log("Waiting for the user-content to be dragged in...")
    return new Promise<File>((resolve, reject) => {
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
                    resolve(e.dataTransfer.files.item(0))
                }
            })
        })
    })
}

function getGameContent(): Promise<File> {
    let fileName = "doom.wad"
    return fetch(`external/${fileName}`)
        .then(res => {
            if (res.ok) {
                return Promise.resolve(res.blob())
            }
            return Promise.reject("Server did not find the WAD file!")
        })
        .then(blob => new File([blob], fileName, {type: WAD.FileMimeType}))
        .catch(err => {
            console.log("Failed to load the remote content:", err)
            return awaitUserContent()
        })
}

function main() {
    let startTime = Date.now()
    getGameContent()
        .then(wadFile => {
            parseWad(wadFile)
                .then(wad => {
                    let wadReceivedTime = Date.now()

                    let gameData = DoomGame.parse(wad);
                    gameData.logStats()

                    let game = new Game(gameData)

                    return game.init().then(() => {
                        game.audio.playMusic("D_INTER")
                        // game.audio.cacheMusic(); // TODO loadscreen?

                        document.querySelectorAll('.audio-trigger').forEach(trigger => {
                            trigger.addEventListener('click', () => game.audio.playMusic(trigger.innerHTML))
                        })

                        return wadReceivedTime
                    })
                })
                .then((wadReceivedTime) => {
                    let endTime = Date.now()
                    console.log(`Game initialized, took ${endTime - startTime}ms (${endTime - wadReceivedTime}ms since WAD was received)!`)
                })
        })
}

window.addEventListener('DOMContentLoaded', main)
