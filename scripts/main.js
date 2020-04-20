function awaitUserContent() {
    function dragStart(e) {
        if (e.target instanceof Element) {
            e.target.classList.add('drag-hover');
        }
    }
    function dragEnd(e) {
        if (e.target instanceof Element) {
            e.target.classList.remove('drag-hover');
        }
    }
    console.log("Waiting for the user-content to be dragged in...");
    return new Promise(function (resolve, reject) {
        document.querySelectorAll('.drop-target').forEach(function (elem) {
            elem.addEventListener('dragenter', function (e) {
                e.preventDefault();
                dragStart(e);
            });
            elem.addEventListener('dragleave', function (e) {
                dragEnd(e);
            });
            elem.addEventListener('dragover', function (e) {
                e.preventDefault();
            });
            elem.addEventListener('drop', function (e) {
                e.preventDefault();
                dragEnd(e);
                if (e.dataTransfer.files.length > 0) {
                    resolve(e.dataTransfer.files.item(0));
                }
            });
        });
    });
}
function getGameContent() {
    var fileName = "doom.wad";
    return fetch("external/" + fileName)
        .then(function (res) {
        if (res.ok) {
            return Promise.resolve(res.blob());
        }
        return Promise.reject("Server did not find the WAD file!");
    })
        .then(function (blob) { return new File([blob], fileName); })
        .catch(function (err) {
        console.log("Failed to load the remote content:", err);
        return awaitUserContent();
    });
}
function main() {
    var startTime = Date.now();
    getGameContent()
        .then(function (wadFile) {
        parseWad(wadFile)
            .then(function (wad) {
            var wadReceivedTime = Date.now();
            var gameData = DoomGame.parse(wad);
            gameData.logStats();
            var game = new Game(gameData);
            return game.init().then(function () {
                game.audio.playMusic("D_INTER");
                // game.audio.cacheMusic(); // TODO loadscreen?
                document.querySelectorAll('.audio-trigger').forEach(function (trigger) {
                    trigger.addEventListener('click', function () { return game.audio.playMusic(trigger.innerHTML); });
                });
                return wadReceivedTime;
            });
        })
            .then(function (wadReceivedTime) {
            var endTime = Date.now();
            console.log("Game initialized, took " + (endTime - startTime) + "ms (" + (endTime - wadReceivedTime) + "ms since WAD was received)!");
        });
    });
}
window.addEventListener('DOMContentLoaded', main);
function logToGameConsole(message) {
    var textArea = document.querySelector("#console textarea");
    textArea.value += message;
    textArea.value += "\n";
    textArea.scrollTop = textArea.scrollHeight;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsU0FBUyxnQkFBZ0I7SUFFckIsU0FBUyxTQUFTLENBQUMsQ0FBWTtRQUMzQixJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksT0FBTyxFQUFFO1lBQzdCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQTtTQUN2QztJQUNMLENBQUM7SUFFRCxTQUFTLE9BQU8sQ0FBQyxDQUFZO1FBQ3pCLElBQUksQ0FBQyxDQUFDLE1BQU0sWUFBWSxPQUFPLEVBQUU7WUFDN0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFBO1NBQzFDO0lBQ0wsQ0FBQztJQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsa0RBQWtELENBQUMsQ0FBQTtJQUMvRCxPQUFPLElBQUksT0FBTyxDQUFPLFVBQUMsT0FBTyxFQUFFLE1BQU07UUFDckMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7WUFDbEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxVQUFDLENBQVk7Z0JBQzVDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQTtnQkFDbEIsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQ2hCLENBQUMsQ0FBQyxDQUFBO1lBQ0YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxVQUFDLENBQVk7Z0JBQzVDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUNkLENBQUMsQ0FBQyxDQUFBO1lBRUYsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxVQUFBLENBQUM7Z0JBQy9CLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQTtZQUN0QixDQUFDLENBQUMsQ0FBQTtZQUVGLElBQUksQ0FBQyxnQkFBZ0Is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