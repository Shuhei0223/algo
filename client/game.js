console.log("★★★ ALGO game.js 最新版を読み込みました ★★★");

const socket = io();

let roomId = null;
let myId = null;

let myHand = [];
let opponentHand = [];

let selectedCardIndex = null;
let selectedNumber = null;

let currentState = null;


// ========================================
// DOM
// ========================================

const lobby =
    document.getElementById("lobby");

const game =
    document.getElementById("game");

const roomDisplay =
    document.getElementById("roomDisplay");

const lobbyMessage =
    document.getElementById("lobbyMessage");

const status =
    document.getElementById("status");

const myHandElement =
    document.getElementById("myHand");

const opponentHandElement =
    document.getElementById("opponentHand");

const deckCount =
    document.getElementById("deckCount");

const drawnCardElement =
    document.getElementById("drawnCard");

const attackPanel =
    document.getElementById("attackPanel");

const successPanel =
    document.getElementById("successPanel");

const selectedCardElement =
    document.getElementById("selectedCard");

const attackButton =
    document.getElementById("attackButton");

const numberButtons =
    document.getElementById("numberButtons");

const message =
    document.getElementById("message");

const gameOver =
    document.getElementById("gameOver");

const gameOverTitle =
    document.getElementById("gameOverTitle");


// ========================================
// ルーム作成
// ========================================

document
    .getElementById("createRoom")
    .addEventListener("click", () => {

        // 選択されている親の決め方を取得
        const parentMode =
            document.querySelector(
                'input[name="parentMode"]:checked'
            ).value;

        console.log(
            "親の決め方:",
            parentMode
        );

        socket.emit(
            "createRoom",
            {
                parentMode: parentMode
            }
        );

    });


// ========================================
// ルーム参加
// ========================================

document
    .getElementById("joinRoom")
    .addEventListener("click", () => {

        const input =
            document
                .getElementById("roomInput")
                .value
                .trim()
                .toUpperCase();

        if (!input) {
            return;
        }

        socket.emit("joinRoom", input);

    });


// ========================================
// ルーム作成完了
// ========================================

socket.on("roomCreated", data => {

    roomId = data.roomId;

    roomDisplay.textContent =
        `ルーム：${roomId}`;

    lobbyMessage.textContent =
        `ルームID「${roomId}」を相手に伝えてください。`;

});


// ========================================
// ルーム参加完了
// ========================================

socket.on("roomJoined", data => {

    roomId = data.roomId;

    roomDisplay.textContent =
        `ルーム：${roomId}`;

    lobbyMessage.textContent =
        "対戦相手と接続しました。";

});


// ========================================
// エラー
// ========================================

socket.on("errorMessage", data => {

    lobbyMessage.textContent =
        data.message;

    message.textContent =
        data.message;

});


// ========================================
// ゲーム状態受信
// ========================================

socket.on("gameState", data => {

    console.log("★★★ GAME STATE受信 ★★★");
console.log(data);
console.log("PHASE =", data.phase);
console.log("TURN =", data.turn);
console.log("MY COLOR =", data.myColor);

    console.log("GAME STATE:", data);

    currentState = data;

    myId = data.myId;

    roomId = data.roomId;

    myHand = data.myHand || [];

    opponentHand = data.opponentHand || [];


    roomDisplay.textContent =
        `ルーム：${roomId}`;


    // ================================
    // ゲーム画面
    // ================================

    if (data.started) {

        lobby.classList.add("hidden");

        game.classList.remove("hidden");

    }


    // ================================
    // カード表示
    // ================================

    renderMyHand();

    renderOpponentHand();

    renderDrawnCard();


    // ================================
    // 山札
    // ================================

   deckCount.textContent =
    `残り${data.deckCount}枚`;

    // ================================
    // ステータス
    // ================================

    updateStatus();


    // ================================
    // パネル
    // ================================

    updatePanels();


    // ================================
    // ゲーム終了
    // ================================

    if (data.phase === "gameover") {

        gameOver.classList.remove(
            "hidden"
        );

        if (data.winner === myId) {

            gameOverTitle.textContent =
                "YOU WIN!";

        } else {

            gameOverTitle.textContent =
                "YOU LOSE...";

        }

        attackPanel.classList.add(
            "hidden"
        );

        successPanel.classList.add(
            "hidden"
        );

    }

});


// ========================================
// 自分の手札を表示
// ========================================

function renderMyHand() {

    myHandElement.innerHTML = "";

    myHand.forEach((card, index) => {

        const element =
            createCardElement(
                card,
                false,
                index
            );

        myHandElement.appendChild(element);

    });

}


// ========================================
// 相手の手札を表示
//
// 相手側から見た並びになるように
// 表示だけ左右反転する
// ========================================

function renderOpponentHand() {

    opponentHandElement.innerHTML = "";

    const reversedHand =
        [...opponentHand].reverse();

    reversedHand.forEach((card) => {

        // 元の配列でのindexを取得
        const originalIndex =
            opponentHand.indexOf(card);

        const element =
            createCardElement(
                card,
                true,
                originalIndex
            );

        opponentHandElement.appendChild(
            element
        );

    });

}



// ========================================
// カード描画
//
// isOpponent
// true  = 相手のカード
// false = 自分のカード
// ========================================

function createCardElement(
    card,
    isOpponent,
    index
) {

    const element =
        document.createElement("div");

    element.classList.add("card");


    // ====================================
    // カードの色
    // ====================================

    const colorName =
        card.color === "black"
            ? "黒"
            : "白";


    // ====================================
    // 自分のカード
    //
    // 自分の手札なら、
    // クローズ状態でも数字が見える
    // ====================================

    if (!isOpponent) {

        element.classList.add(card.color);

        element.innerHTML = `

            <div class="cardColor">
                ${colorName}
            </div>

            <div class="cardNumber">
                ${card.number}
            </div>

        `;

    }


    // ====================================
    // 相手のカード
    // ====================================

    else {

        // -----------------------------
        // 相手のオープンカード
        // -----------------------------

        if (card.open) {

            element.classList.add(
                card.color
            );

            element.innerHTML = `

                <div class="cardColor">
                    ${colorName}
                </div>

                <div class="cardNumber">
                    ${card.number}
                </div>

            `;

        }


        // -----------------------------
        // 相手のクローズカード
        // -----------------------------

        else {

            element.classList.add(
                "closed"
            );

            element.classList.add(
                card.color
            );

            element.innerHTML = `

                <div class="cardColor">
                    ${colorName}
                </div>

                <div class="cardNumber">
                    ?
                </div>

            `;
        }


        // ====================================
        // アタック対象として選択可能
        // ====================================

        if (
            !card.open &&
            currentState &&
            currentState.phase === "attack" &&
            currentState.turn === currentState.myColor
        ) {

            element.classList.add(
                "selectable"
            );


            // 選択中
            if (
                index === selectedCardIndex
            ) {

                element.classList.add(
                    "selected"
                );

            }


            // クリック
            element.addEventListener(
                "click",
                () => {

                    selectOpponentCard(index);

                }
            );
        }

    }


    return element;
}


// ========================================
// 引いたカード
// ========================================

function renderDrawnCard() {

    const card =
        currentState?.drawnCard;


    if (!card) {

        drawnCardElement.classList.add(
            "hidden"
        );

        drawnCardElement.innerHTML = "";

        return;
    }


    drawnCardElement.classList.remove(
        "hidden"
    );


    drawnCardElement.className =
        "card";


    drawnCardElement.classList.add(
        card.color
    );


    const colorName =
        card.color === "black"
            ? "黒"
            : "白";


    drawnCardElement.innerHTML = `

        <div class="cardColor">
            ${colorName}
        </div>

        <div class="cardNumber">
            ${card.number}
        </div>

    `;
}


// ========================================
// 相手カード選択
// ========================================

function selectOpponentCard(index) {

    selectedCardIndex = index;

    selectedNumber = null;


    selectedCardElement.textContent =
        `カード ${index + 1} を選択中`;


    attackButton.disabled = true;


    renderOpponentHand();

}


// ========================================
// 数字ボタン
// ========================================

function createNumberButtons() {

    numberButtons.innerHTML = "";


    for (let i = 0; i <= 11; i++) {

        const button =
            document.createElement("button");


        button.textContent = i;


        button.addEventListener(
            "click",
            () => {

                selectNumber(i);

            }
        );


        numberButtons.appendChild(
            button
        );

    }

}

createNumberButtons();


// ========================================
// 数字選択
// ========================================

function selectNumber(number) {

    if (
        selectedCardIndex === null
    ) {

        return;

    }


    selectedNumber = number;


    selectedCardElement.textContent =
        `カード ${selectedCardIndex + 1} に「${number}」と宣言`;


    attackButton.disabled = false;

}


// ========================================
// アタック
// ========================================

attackButton.addEventListener(
    "click",
    () => {

        if (
            selectedCardIndex === null ||
            selectedNumber === null
        ) {

            return;

        }


        socket.emit(
            "attack",
            {
                roomId,

                cardIndex:
                    selectedCardIndex,

                number:
                    selectedNumber
            }
        );


        attackButton.disabled = true;

    }
);


// ========================================
// アタック結果
// ========================================

socket.on(
    "attackResult",
    data => {

        if (data.success) {

            message.textContent =
                "🎯 アタック成功！";

        } else {

            message.textContent =
                "❌ アタック失敗！";

        }

    }
);


// ========================================
// 成功後：続ける
// ========================================

document
    .getElementById("continueButton")
    .addEventListener(
        "click",
        () => {

            socket.emit(
                "continueAttack",
                {
                    roomId
                }
            );

        }
    );


// ========================================
// 成功後：ターン交代
// ========================================

document
    .getElementById("endTurnButton")
    .addEventListener(
        "click",
        () => {

            socket.emit(
                "endTurn",
                {
                    roomId
                }
            );

        }
    );


// ========================================
// ステータス
// ========================================

function updateStatus() {

    if (!currentState) {
        return;
    }


    if (!currentState.started) {

        status.textContent =
            "対戦相手を待っています……";

        return;
    }


    if (
        currentState.phase ===
        "starting"
    ) {

        status.textContent =
            "ゲーム開始！";

        return;
    }


    if (
        currentState.phase ===
        "attack"
    ) {

        if (
            currentState.turn ===
            currentState.myColor
        ) {

            status.textContent =
                "あなたのターン";

        } else {

            status.textContent =
                "相手のターン";

        }

        return;
    }


    if (
        currentState.phase ===
        "successChoice"
    ) {

        if (
            currentState.turn ===
            currentState.myColor
        ) {

            status.textContent =
                "アタック成功！次の行動を選択してください";

        } else {

            status.textContent =
                "相手が次の行動を選択中……";

        }

        return;
    }

}


// ========================================
// パネル
// ========================================

function updatePanels() {

    if (!currentState) {
        return;
    }


    console.log(
        "UPDATE PANELS:",
        currentState.phase,
        currentState.turn,
        currentState.myColor
    );


    const myTurn =
        currentState.turn ===
        currentState.myColor;


    // =================================
    // 全部いったん隠す
    // =================================

    attackPanel.classList.add(
        "hidden"
    );

    successPanel.classList.add(
        "hidden"
    );


    // =================================
    // アタック可能
    // =================================

    if (
        currentState.phase === "attack" &&
        myTurn
    ) {

        attackPanel.classList.remove(
            "hidden"
        );

        return;
    }


    // =================================
    // アタック成功後
    // =================================

    if (
        currentState.phase === "successChoice" &&
        myTurn
    ) {

        successPanel.classList.remove(
            "hidden"
        );

        return;
    }

}