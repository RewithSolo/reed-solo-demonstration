from reedsolo import RSCodec, ReedSolomonError
from flask import Blueprint, render_template, request, jsonify

main = Blueprint("main", __name__)

CODEC_CONFIGS = {
    2: {"name": "RS(17,15)", "nsym": 2, "data_bytes": 15, "description": "1 ошибка"},
    4: {"name": "RS(17,13)", "nsym": 4, "data_bytes": 13, "description": "2 ошибки"},
    6: {"name": "RS(17,11)", "nsym": 6, "data_bytes": 11, "description": "3 ошибки"},
    8: {"name": "RS(17,9)", "nsym": 8, "data_bytes": 9, "description": "4 ошибки"},
    10: {"name": "RS(17,7)", "nsym": 10, "data_bytes": 7, "description": "5 ошибок"},
}

# Выбор кодека по умолчанию
current_nsym = 6
rs = RSCodec(current_nsym)


@main.route("/")
def index():
    return render_template("index.html")


@main.route("/api/configs", methods=["GET"])
def get_configs():
    return jsonify(CODEC_CONFIGS)


@main.route("/api/info", methods=["GET"])
def get_info():
    return jsonify({
        "title": "Reed-Solomon Codes Explained",
        "sections": [
            {
                "title": "Основные параметры",
                "content": "Код RS определяется двумя параметрами: k (данные) и n (общая длина). Количество проверочных символов nsym = n - k."
            },
            {
                "title": "Способность к коррекции",
                "content": "Код RS может исправить до floor(nsym/2) ошибок неизвестных позиций или nsym стираний известных позиций."
            },
            {
                "title": "Расстояние Хэмминга",
                "content": "Минимальное расстояние Хэмминга для RS кода равно nsym + 1. Это гарантирует возможность коррекции."
            },
            {
                "title": "Практическое применение",
                "content": "RS коды используются где нужна надёжность: QR-коды, спутники, облако, 5G."
            }
        ]
    })


@main.route("/api/scenarios", methods=["GET"])
def get_scenarios():
    return jsonify([
        {
            "id": "demo_success",
            "title": "✓ Успешное восстановление",
            "description": "Демонстрирует, как 1-2 ошибки успешно исправляются",
            "message": "HELLO",
            "nsym": 6,
            "mode": "error",
            "positions": [2, 5],
            "info": "Выбранный код может исправлять до 3 ошибок. Выбрано 2 ошибки — восстановление удастся."
        },
        {
            "id": "demo_limit",
            "title": "⚠ На пределе способности",
            "description": "3 ошибки — максимум для RS(6)",
            "message": "WORLD",
            "nsym": 6,
            "mode": "error",
            "positions": [1, 3, 7],
            "info": "Код исправляет ровно 3 ошибки. Это предельный случай — алгоритм едва справляется."
        },
        {
            "id": "demo_failure",
            "title": "✗ Превышена способность",
            "description": "4 ошибки — невозможно восстановить",
            "message": "TEST",
            "nsym": 6,
            "mode": "error",
            "positions": [0, 2, 4, 6],
            "info": "Слишком много ошибок! Даже проверочные символы могут быть повреждены. Восстановление невозможно."
        },
        {
            "id": "demo_erasure",
            "title": "✓ Стирания (erasures)",
            "description": "Восстановление при известных позициях ошибок",
            "message": "DATA",
            "nsym": 6,
            "mode": "erasure",
            "positions": [1, 3, 5],
            "info": "При стираниях (известные позиции повреждений) код может исправить до nsym ошибок. Для 6 стираний нужно 6 проверочных символов."
        },
        {
            "id": "demo_weak_code",
            "title": "Слабый код (RS-2)",
            "description": "Демонстрация RS(17,15) — исправляет только 1 ошибку",
            "message": "HI",
            "nsym": 2,
            "mode": "error",
            "positions": [1],
            "info": "Код RS(17,15) может исправить только 1 ошибку (nsym=2). Выбран RS(17,15) - минимально надежный вариант."
        },
        {
            "id": "demo_strong_code",
            "title": "Сильный код (RS-10)",
            "description": "Демонстрация RS(17,7) — исправляет до 5 ошибок",
            "message": "OK",
            "nsym": 10,
            "mode": "error",
            "positions": [0, 2, 4, 6, 8],
            "info": "Код RS(17,7) может исправить до 5 ошибок (nsym=10). Высокая избыточность обеспечивает надежность."
        }
    ])


@main.route("/api/config", methods=["POST"])
def set_config():
    global rs, current_nsym
    data = request.get_json()
    nsym = data.get("nsym")

    if nsym not in CODEC_CONFIGS:
        return jsonify({"error": "Неизвестная конфигурация"}), 400

    current_nsym = nsym
    rs = RSCodec(nsym)
    config = CODEC_CONFIGS[nsym]

    return jsonify({
        "name": config["name"],
        "nsym": nsym,
        "data_bytes": config["data_bytes"],
        "description": config["description"]
    })


@main.route("/api/encode", methods=["POST"])
def encode():
    data = request.get_json()
    message = data.get("message", "")
    nsym = data.get("nsym", current_nsym)

    if not isinstance(message, str) or not message:
        return jsonify({"error": "Введите сообщение"}), 400

    if nsym not in CODEC_CONFIGS:
        return jsonify({"error": "Неизвестная конфигурация"}), 400

    config = CODEC_CONFIGS[nsym]
    message_bytes = message.encode("utf-8")

    if len(message_bytes) > config["data_bytes"]:
        return jsonify({
            "error": f"Сообщение должно занимать не более {config['data_bytes']} байтов UTF-8"
        }), 400

    codec = RSCodec(nsym)
    encoded = codec.encode(message_bytes)

    data_symbols = list(message_bytes)
    parity_symbols = list(encoded[len(message_bytes):])

    actual_data_length = len(message_bytes)
    total_codeword_length = len(encoded)

    return jsonify({
        "data": data_symbols,
        "parity": parity_symbols,
        "codeword": list(encoded),
        "config": {
            "name": config["name"],
            "nsym": nsym,
            "data_bytes": config["data_bytes"],
            "actual_data_length": actual_data_length,
            "total_codeword_length": total_codeword_length,
            "correction_capability": nsym // 2,
            "erasure_capability": nsym,
            "description": config["description"]
        }
    })


@main.route("/api/corrupt", methods=["POST"])
def corrupt():
    data = request.get_json() or {}

    message = data.get("message", "")
    positions = data.get("positions", [])
    mode = data.get("mode", "error")
    nsym = data.get("nsym", current_nsym)

    if not isinstance(message, str) or not message:
        return jsonify({"error": "Сообщение не должно быть пустым"}), 400

    if nsym not in CODEC_CONFIGS:
        return jsonify({"error": "Неизвестная конфигурация"}), 400

    config = CODEC_CONFIGS[nsym]
    message_bytes = message.encode("utf-8")
    total_length = config["data_bytes"] + nsym

    if len(message_bytes) > config["data_bytes"]:
        return jsonify({"error": "Сообщение слишком длинное"}), 400

    if not isinstance(positions, list):
        return jsonify({"error": "Позиции должны быть списком"}), 400

    if any(type(pos) is not int or not 0 <= pos < total_length for pos in positions):
        return jsonify({"error": "Некорректная позиция"}), 400

    if len(set(positions)) != len(positions):
        return jsonify({"error": "Позиции не должны повторяться"}), 400

    if mode not in ("error", "erasure"):
        return jsonify({"error": "Неизвестный режим повреждения"}), 400

    codec = RSCodec(nsym)
    encoded = codec.encode(message_bytes)

    original = bytearray(encoded)
    corrupted = bytearray(encoded)

    for pos in positions:
        if mode == "error":
            corrupted[pos] ^= 0xFF
        elif mode == "erasure":
            corrupted[pos] = 0

    num_errors = len(positions)
    correction_capability = nsym // 2
    erasure_capability = nsym

    recoverable = (
        (mode == "error" and num_errors <= correction_capability) or
        (mode == "erasure" and num_errors <= erasure_capability)
    )

    warning = None
    if mode == "error" and num_errors > correction_capability:
        warning = f"⚠ Ошибок: {num_errors}, способность к коррекции: {correction_capability}. Восстановление может не удаться!"
    elif mode == "erasure" and num_errors > erasure_capability:
        warning = f"⚠ Стираний: {num_errors}, способность к коррекции: {erasure_capability}. Восстановление невозможно!"

    return jsonify({
        "original": list(original),
        "corrupted": list(corrupted),
        "changed_positions": positions,
        "mode": mode,
        "recoverable": recoverable,
        "warning": warning,
        "stats": {
            "num_errors": num_errors,
            "correction_capability": correction_capability,
            "erasure_capability": erasure_capability
        }
    })

@main.route("/api/decode", methods=["POST"])
def decode():
    data = request.get_json() or {}

    corrupted = data.get("corrupted")
    erasures = data.get("erasures", [])
    nsym = data.get("nsym", current_nsym)

    if not isinstance(corrupted, list):
        return jsonify({"error": "Некорректное кодовое слово"}), 400

    if nsym not in CODEC_CONFIGS:
        return jsonify({"error": "Неизвестная конфигурация"}), 400

    config = CODEC_CONFIGS[nsym]
    min_length = nsym + 1  # At least 1 byte of data + parity
    max_length = config["data_bytes"] + nsym

    if not (min_length <= len(corrupted) <= max_length):
        return jsonify({"error": f"Некорректная длина кодового слова, ожидается от {min_length} до {max_length}"}), 400

    if any(
        type(symbol) is not int or not 0 <= symbol <= 255
        for symbol in corrupted
    ):
        return jsonify({"error": "Символы должны быть байтами"}), 400

    if not isinstance(erasures, list):
        return jsonify({"error": "Стирания должны быть списком"}), 400

    if any(
        type(pos) is not int or not 0 <= pos < len(corrupted)
        for pos in erasures
    ):
        return jsonify({"error": "Некорректная позиция стирания"}), 400

    if len(set(erasures)) != len(erasures):
        return jsonify({"error": "Позиции стираний не должны повторяться"}), 400

    try:
        codec = RSCodec(nsym)
        decoded, corrected, errata_positions = codec.decode(
            bytearray(corrupted),
            erase_pos=erasures
        )

        try:
            decoded_text = bytes(decoded).decode("utf-8")
        except UnicodeDecodeError:
            decoded_text = None

        return jsonify({
            "success": True,
            "decoded": list(decoded),
            "decoded_text": decoded_text,
            "corrected": list(corrected),
            "corrected_positions": list(errata_positions),
            "num_corrected": len(errata_positions)
        })

    except ReedSolomonError as e:
        return jsonify({
            "success": False,
            "error": "Декодирование не удалось. Превышена способность кода исправлять ошибки."
        }), 422
