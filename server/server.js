const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("client"));

const PORT = process.env.PORT || 3000;

const rooms = {};

// ========================================
// カード
// ========================================

function createDeck() {
    const deck = [];

    for (let number = 0; number <= 11; number++) {
        deck.push({
            id: `black-${number}`,
            color: "black",
            number,
            open: false
        });

        deck.push({
            id: `white-${number}`,
            color: "white",
            number,
            open: false
        });
    }

    return deck;
}

// ========================================
// シャッフル
// ========================================

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

// ========================================
// 手札を並び替える
//
// 数字が小さい → 大きい
// 同じ数字なら 黒 → 白
// ========================================

function sortHand(hand) {
    hand.sort((a, b) => {
        if (a.number !== b.number) {
            return a.number - b.number;
        }

        if (a.color === b.color) {
            return 0;
        }

        return a.color === "black" ? -1 : 1;
    });
}

// ========================================
// ルームID
// ========================================

function createRoomId() {
    let id;

    do {
        id = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
    } while (rooms[id]);

    return id;
}

// ========================================
// プレイヤー公開情報
// ========================================

function publicCard(card) {
    if (card.open) {
        return {
            id: card.id,
            color: card.color,
            number: card.number,
            open: true
        };
    }

    return {
        id: card.id,
        color: card.color,
        number: null,
        open: false
    };
}

// ========================================
// 自分用のカード情報
// ========================================

function privateCard(card) {
    return {
        id: card.id,
        color: card.color,
        number: card.number,
        open: card.open
    };
}

// ========================================
// プレイヤーにゲーム状態を送る
// ========================================

function sendGameState(roomId) {
    const room = rooms[roomId];

    if (!room) {
        return;
    }

    for (const player of room.players) {

        const opponent =
            room.players.find(p => p.id !== player.id);

        const myHand = player.hand.map(privateCard);

        const opponentHand = opponent
            ? opponent.hand.map(publicCard)
            : [];

        io.to(player.id).emit("gameState", {
            roomId,
            started: room.started,
            myId: player.id,
            myColor: player.color,
            myRole: player.role,

            myHand,

            opponentHand,

            deckCount: room.deck.length,

            turn: room.turn,

            phase: room.phase,

            drawnCard: player.drawnCard
                ? privateCard(player.drawnCard)
                : null,

            winner: room.winner || null,

            loser: room.loser || null
        });
    }
}

// ========================================
// 勝敗チェック
// ========================================

function checkLose(room) {

    for (const player of room.players) {

        const allOpen =
            player.hand.length > 0 &&
            player.hand.every(card => card.open);

        if (allOpen) {

            const loser = player;
            const winner =
                room.players.find(p => p.id !== player.id);

            room.phase = "gameover";

            room.loser = loser.id;
            room.winner = winner ? winner.id : null;

            return true;
        }
    }

    return false;
}

// ========================================
// ターン開始
// ========================================

function startTurn(room) {

    const player =
        room.players.find(p => p.color === room.turn);

    if (!player) {
        return;
    }

    // 山札から1枚引く
    if (room.deck.length === 0) {
        console.log("山札がありません");
        return;
    }

    player.drawnCard = room.deck.pop();

    // このカードはまだopen=false
    // 自分だけが数字を知る

    room.phase = "attack";

    sendGameState(room.id);
}

// ========================================
// ターン交代
// ========================================

function changeTurn(room) {

    // 現在のターンプレイヤー
    const player =
        room.players.find(
            p => p.color === room.turn
        );

    // ========================================
    // 引いていたカードを手札に戻す
    // ========================================

    if (player && player.drawnCard) {

        // クローズ状態のまま手札へ追加
        player.drawnCard.open = false;

        player.hand.push(
            player.drawnCard
        );

        // 並び順を整える
        sortHand(
            player.hand
        );

        // 引いたカードを消す
        player.drawnCard = null;
    }


    // ========================================
    // ターン交代
    // ========================================

    room.turn =
        room.turn === "red"
            ? "blue"
            : "red";


    // ========================================
    // 次のプレイヤーのターン開始
    // ========================================

    startTurn(room);
}

// ========================================
// 接続
// ========================================

io.on("connection", socket => {

    console.log("接続:", socket.id);

    // ====================================
    // ルーム作成
    // ====================================

    socket.on("createRoom", data => {

        const roomId = createRoomId();

        const player = {
            id: socket.id,
            color: "red",
            role: "waiting",
            hand: [],
            drawnCard: null
        };

        rooms[roomId] = {
    id: roomId,

    players: [player],

    deck: [],

    started: false,

    turn: null,

    phase: "waiting",

    winner: null,
    loser: null,

    // 親の決め方
    parentMode:
        data?.parentMode === "me" ||
        data?.parentMode === "opponent" ||
        data?.parentMode === "random"
            ? data.parentMode
            : "random"
};

        socket.join(roomId);

        socket.emit("roomCreated", {
            roomId
        });

        sendGameState(roomId);

        console.log(
            `ルーム作成: ${roomId}`
        );
    });

    // ====================================
    // ルーム参加
    // ====================================

    socket.on("joinRoom", roomId => {

        roomId = String(roomId)
            .trim()
            .toUpperCase();

        const room = rooms[roomId];

        if (!room) {

            socket.emit("errorMessage", {
                message: "ルームが存在しません。"
            });

            return;
        }

        if (room.players.length >= 2) {

            socket.emit("errorMessage", {
                message: "このルームは満員です。"
            });

            return;
        }

        const player = {
            id: socket.id,
            color: "blue",
            role: "waiting",
            hand: [],
            drawnCard: null
        };

        room.players.push(player);

        socket.join(roomId);

        socket.emit("roomJoined", {
            roomId
        });

        // ゲーム開始
        startGame(room);

        console.log(
            `ルーム参加: ${roomId}`
        );
    });

    // ====================================
    // ゲーム開始
    // ====================================

    function startGame(room) {

        if (room.players.length !== 2) {
            return;
        }

        room.started = true;

        room.deck = shuffle(createDeck());

        // 4枚ずつ配る
        for (const player of room.players) {

            player.hand = [];

            for (let i = 0; i < 4; i++) {
                player.hand.push(room.deck.pop());
            }

            sortHand(player.hand);
        }

     // ========================================
// 親を決定
// ========================================

let parentIndex;


// ----------------------------------------
// 自分が親
// ----------------------------------------

if (room.parentMode === "me") {

    // ルーム作成者 = players[0]
    parentIndex = 0;

}


// ----------------------------------------
// 相手が親
// ----------------------------------------

else if (room.parentMode === "opponent") {

    // 相手 = players[1]
    parentIndex = 1;

}


// ----------------------------------------
// ランダム
// ----------------------------------------

else {

    parentIndex =
        Math.floor(Math.random() * 2);

}


// ========================================
// 子を決定
// ========================================

const childIndex =
    parentIndex === 0
        ? 1
        : 0;


// ========================================
// role設定
// ========================================

room.players[parentIndex].role =
    "parent";

room.players[childIndex].role =
    "child";


// ========================================
// 親の色が最初のターン
// ========================================

room.turn =
    room.players[parentIndex].color;

        // red / blue のどちらが親でもOK
        room.turn =
            room.players[parentIndex].color;

        room.phase = "starting";

        sendGameState(room.id);

setTimeout(() => {

    startTurn(room);

}, 1000);
    }

    // ====================================
    // アタック
    // ====================================

    socket.on("attack", data => {

    const room = rooms[data.roomId];

    if (!room) {
        console.log("ルームがありません");
        return;
    }


    console.log("========== ATTACK ==========");
    console.log("room.phase:", room.phase);
    console.log("room.turn:", room.turn);
    console.log("socket.id:", socket.id);


    // ========================================
    // アタックできる状態か
    // ========================================

    if (room.phase !== "attack") {

        console.log(
            "アタック不可 phase:",
            room.phase
        );

        return;
    }


    // ========================================
    // 攻撃プレイヤー
    // ========================================

    const player =
        room.players.find(
            p => p.id === socket.id
        );


    if (!player) {

        console.log(
            "プレイヤーが見つかりません"
        );

        return;
    }


    // ========================================
    // 自分のターンか
    // ========================================

    if (player.color !== room.turn) {

        console.log(
            "自分のターンではありません"
        );

        return;
    }


    // ========================================
    // 相手
    // ========================================

    const opponent =
        room.players.find(
            p => p.id !== socket.id
        );


    if (!opponent) {

        console.log(
            "相手が見つかりません"
        );

        return;
    }


    // ========================================
    // 入力値
    // ========================================

    const cardIndex =
        Number(data.cardIndex);

    const declaredNumber =
        Number(data.number);


    console.log(
        "cardIndex:",
        cardIndex
    );

    console.log(
        "declaredNumber:",
        declaredNumber
    );


    // ========================================
    // カード番号チェック
    // ========================================

    if (
        cardIndex < 0 ||
        cardIndex >= opponent.hand.length
    ) {

        console.log(
            "カード番号が不正"
        );

        return;
    }


    // ========================================
    // 数字チェック
    // ========================================

    if (
        declaredNumber < 0 ||
        declaredNumber > 11
    ) {

        console.log(
            "宣言数字が不正"
        );

        return;
    }


    // ========================================
    // 攻撃対象カード
    // ========================================

    const target =
        opponent.hand[cardIndex];


    console.log(
        "target:",
        target
    );


    // ========================================
    // すでにオープンされているカードには
    // アタックできない
    // ========================================

    if (target.open) {

        console.log(
            "すでにオープンされています"
        );

        return;
    }


    // ========================================
    // アタック判定
    // ========================================

    if (
        target.number === declaredNumber
    ) {

        // ====================================
        // 成功
        // ====================================

        console.log(
            "★★★ ATTACK SUCCESS ★★★"
        );


        // 相手カードをオープン
        target.open = true;


        // 成功メッセージ
        socket.emit(
            "attackResult",
            {
                success: true,
                message: "アタック成功！"
            }
        );


        // ====================================
        // すべてオープンしたか
        // ====================================

       if (checkLose(room)) {

    console.log(
        "ゲーム終了"
    );

    sendGameState(data.roomId);

    return;
}

// ====================================
// 成功後の選択状態
// ====================================

room.phase = "successChoice";

console.log(
    "★★★ phase changed to successChoice ★★★"
);


// ====================================
// 最新状態を両プレイヤーに送信
// ====================================

sendGameState(data.roomId);

console.log(
    "★★★ successChoice sent ★★★"
);

return;

    }


    // ========================================
    // 失敗
    // ========================================

    console.log(
        "XXX ATTACK FAILED XXX"
    );


    // ========================================
    // 引いたカードをオープン
    // ========================================

    if (player.drawnCard) {

        player.drawnCard.open = true;


        // 手札に追加
        player.hand.push(
            player.drawnCard
        );


        // 並び替え
        sortHand(
            player.hand
        );


        // 引いたカードを消す
        player.drawnCard = null;

    }


    // ========================================
    // 失敗通知
    // ========================================

    socket.emit(
        "attackResult",
        {
            success: false,
            message: "アタック失敗……"
        }
    );


    // ========================================
    // 敗北チェック
    // ========================================

    if (checkLose(room)) {

    sendGameState(data.roomId);

    return;
}


    // ========================================
    // ターン交代
    // ========================================

    changeTurn(room);

});

    // ====================================
    // 成功後：続けて攻撃
    // ====================================

   socket.on("continueAttack", data => {

    const room = rooms[data.roomId];

    if (!room) {
        return;
    }


    // 成功後の選択中でなければ無視
    if (room.phase !== "successChoice") {
        return;
    }


    const player =
        room.players.find(
            p => p.id === socket.id
        );


    if (!player) {
        return;
    }


    // 自分のターンか確認
    if (player.color !== room.turn) {
        return;
    }


    console.log(
        `${player.color} が続けてアタック`
    );


// 再びアタック可能
room.phase = "attack";

sendGameState(room.id);
});
    // ====================================
    // 成功後：ターン交代
    // ====================================

    socket.on("endTurn", data => {

    const room = rooms[data.roomId];

    if (!room) {
        return;
    }


    // 成功後の選択中でなければ無視
    if (room.phase !== "successChoice") {
        return;
    }


    const player =
        room.players.find(
            p => p.id === socket.id
        );


    if (!player) {
        return;
    }


    // 自分のターンか確認
    if (player.color !== room.turn) {
        return;
    }


    console.log(
        `${player.color} がターン交代`
    );


    // ターン交代
    changeTurn(room);

});

    // ====================================
    // 切断
    // ====================================

    socket.on("disconnect", () => {

        console.log(
            "切断:",
            socket.id
        );

        for (const roomId in rooms) {

            const room = rooms[roomId];

            const index =
                room.players.findIndex(
                    p => p.id === socket.id
                );

            if (index !== -1) {

                room.players.splice(index, 1);

                if (room.players.length === 0) {

                    delete rooms[roomId];

                } else {

                    const remaining =
                        room.players[0];

                    io.to(remaining.id).emit(
                        "errorMessage",
                        {
                            message:
                                "相手が退出しました。"
                        }
                    );

                    sendGameState(roomId);
                }

                break;
            }
        }
    });
});

server.listen(PORT, () => {

    console.log(
        `ALGO server started: ${PORT}`
    );

});