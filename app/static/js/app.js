// State
let selectedPositions = new Set();
let currentMessage = "";
let currentCorrupted = [];
let currentNsym = 6;
let currentConfig = {};
let currentMessageBytes = [];
window.erasurePositions = []; // Для передачи позиций стираний при декодировании

// Initialize when DOM is ready
console.log("App starting...");

// Wait for DOM if needed
function initApp() {
    console.log("Initializing app...");

    // Get elements
    const encodeButton = document.getElementById("encodeBtn");
    const codecSelect = document.getElementById("codecSelect");
    const theoryToggle = document.getElementById("theoryToggle");
    const theoryContent = document.getElementById("theoryContent");
    const messageInput = document.getElementById("message");
    const corruptBtn = document.getElementById("corruptBtn");
    const decodeBtn = document.getElementById("decodeBtn");

    // Check if elements exist
    if (!encodeButton) {
        console.error("❌ Encode button not found!");
        return;
    }
    if (!codecSelect) {
        console.error("❌ Codec select not found!");
        return;
    }

    console.log("✓ All elements found");

    // Attach event listeners
    encodeButton.addEventListener("click", encodeMessage);
    codecSelect.addEventListener("change", onCodecChange);
 messageInput.addEventListener("input", () => {
        updateMessageLength();
        clearResults();
    });

    if (theoryToggle && theoryContent) {
        theoryToggle.addEventListener("click", () => {
            theoryContent.classList.toggle("hidden");
            theoryToggle.textContent = theoryContent.classList.contains("hidden")
                ? "📖 Как это работает?"
                : "📖 Скрыть объяснение";
        });
    }

    if (corruptBtn) {
        corruptBtn.addEventListener("click", corruptMessage);
    }

    if (decodeBtn) {
        decodeBtn.addEventListener("click", decodeMessage);
    }

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
        resetBtn.addEventListener("click", resetAll);
    }

    const damageMode = document.getElementById("damageMode");
    if (damageMode) {
        damageMode.addEventListener("change", onDamageModeChange);
    }

    console.log("✓ Event listeners attached");

    // Initialize UI
    updateCodecInfo();
    updateMessageLength();
    loadScenarios();
}

// Initialize on DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

async function onCodecChange() {
    currentNsym = parseInt(document.getElementById("codecSelect").value);
    updateCodecInfo();
    clearResults();
    if (currentMessage) {
        encodeMessage();
    }
}

function onDamageModeChange() {
    const mode = document.getElementById("damageMode").value;
    console.log("Damage mode changed to:", mode);

    // Clear selections when mode changes
    selectedPositions.clear();
    const codewordCells = document.getElementById("codeword");
    if (codewordCells) {
        Array.from(codewordCells.children).forEach(cell => {
            cell.classList.remove("symbol-selected");
        });
    }

    // Show mode hint
    const hint = document.getElementById("modeHint");
    if (mode === "error") {
        hint.textContent = "→ Выбери неизвестные ошибки";
    } else {
        hint.textContent = "→ Выбери известные позиции стираний";
    }

    // Clear corruption results (keep encoding visible)
    document.getElementById("corruptionResult").classList.add("hidden");
    document.getElementById("decodeResult").classList.add("hidden");

    console.log("✓ Mode changed, selections cleared");
}

function clearResults() {
    // Clear corruption and decode results
    document.getElementById("result").classList.add("hidden");
    document.getElementById("corruptionResult").classList.add("hidden");
    document.getElementById("decodeResult").classList.add("hidden");
    document.getElementById("failureInfo").classList.add("hidden");

    // Clear all info messages
    const corruptionInfo = document.getElementById("corruptionInfo");
    if (corruptionInfo) {
        corruptionInfo.textContent = "";
        // Remove any warning divs that might be siblings
        const parent = corruptionInfo.parentNode;
        if (parent) {
            Array.from(parent.querySelectorAll("div[style*='#f87171']")).forEach(el => el.remove());
        }
    }

    // Clear selections
    selectedPositions.clear();
    window.erasurePositions = [];
    const codewordCells = document.getElementById("codeword");
    if (codewordCells) {
        Array.from(codewordCells.children).forEach(cell => {
            cell.classList.remove("symbol-selected");
        });
    }

    console.log("✓ Results cleared");
}

function resetAll() {
    console.log("Resetting all...");

    // Reset inputs
    document.getElementById("message").value = "HELLO";
    document.getElementById("codecSelect").value = "6";
    document.getElementById("damageMode").value = "error";

    // Reset state
    currentMessage = "";
    currentCorrupted = [];
    currentNsym = 6;
    selectedPositions.clear();

    // Clear all results
    clearResults();
    document.getElementById("errorMessage").textContent = "";

    // Reset UI
    updateCodecInfo();
    updateMessageLength();

    // Scroll to top
    document.querySelector(".input-group").scrollIntoView({ behavior: "smooth" });

    console.log("✓ All reset to default");
}

function updateCodecInfo() {
    const infos = {
        2: "1 ошибка или 2 стирания",
        4: "2 ошибки или 4 стирания",
        6: "3 ошибки или 6 стираний",
        8: "4 ошибки или 8 стираний",
        10: "5 ошибок или 10 стираний"
    };

    const lengths = {
        2: 15,
        4: 13,
        6: 11,
        8: 9,
        10: 7
    };

    const info = document.getElementById("codecInfo");
    const len = lengths[currentNsym];
    info.textContent = `Макс. длина сообщения: ${len} байтов • Способность к коррекции: ${infos[currentNsym]}`;

    const msgInput = document.getElementById("message");
    msgInput.maxLength = len;

    const codecName = {
        2: "RS(17,15)",
        4: "RS(17,13)",
        6: "RS(17,11)",
        8: "RS(17,9)",
        10: "RS(17,7)"
    };

    const infoHtml = `
        <strong>Выбранный код:</strong> ${codecName[currentNsym]}<br>
        <strong>Проверочные символы:</strong> ${currentNsym}<br>
        <strong>Исправляет:</strong> ${Math.floor(currentNsym/2)} ошибок или ${currentNsym} стираний
    `;

    const info2 = document.getElementById("codecInfo");
    if (info2) info2.innerHTML = infoHtml;
}

function updateMessageLength() {
    const msg = document.getElementById("message").value;
    const bytes = new TextEncoder().encode(msg);
    const info = document.getElementById("messageLength");
    const lengths = { 2: 15, 4: 13, 6: 11, 8: 9, 10: 7 };
    const max = lengths[currentNsym];
    info.textContent = `${bytes.length} из ${max} байтов`;
    if (bytes.length > max) {
        info.style.color = "#f87171";
    } else {
        info.style.color = "#8491a8";
    }
}

function updateSelectionCounter() {
    const count = selectedPositions.size;
    const counter = document.getElementById("selectionCount");
    if (counter) {
        const mode = document.getElementById("damageMode").value;
        const maxForMode = mode === "error" ? Math.floor(currentNsym / 2) : currentNsym;

        let text = `Выбрано символов: ${count}`;
        if (count > 0) {
            text += ` / макс. ${maxForMode}`;
        }

        counter.textContent = text;

        // Color warning if exceeds
        if (count > maxForMode) {
            counter.parentElement.style.borderLeftColor = "#f87171";
            counter.style.color = "#f87171";
        } else if (count === maxForMode && count > 0) {
            counter.parentElement.style.borderLeftColor = "#fbbf24";
            counter.style.color = "#fbbf24";
        } else {
            counter.parentElement.style.borderLeftColor = "#60a5fa";
            counter.style.color = "#a5b4cc";
        }
    }
}

async function encodeMessage() {
    console.log("Encoding message...");
    const message = document.getElementById("message").value;
    const errorMessage = document.getElementById("errorMessage");
    const result = document.getElementById("result");

    errorMessage.textContent = "";
    result.classList.add("hidden");

    try {
        const response = await fetch("/api/encode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message, nsym: currentNsym })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        currentMessage = message;
        currentMessageBytes = data.data;
        currentConfig = data.config;
        selectedPositions.clear();

        renderConfigInfo(data.config);
        renderSymbols("dataSymbols", data.data, "data");
        renderSymbols("paritySymbols", data.parity, "parity");
        renderSelectableCodeword(data.codeword);

        document.getElementById("corruptionResult").classList.add("hidden");
        result.classList.remove("hidden");
        console.log("✓ Encoding successful");

    } catch (error) {
        console.error("Encoding error:", error);
        errorMessage.textContent = error.message;
        errorMessage.style.color = "#f87171";
    }
}

function renderConfigInfo(config) {
    const container = document.getElementById("configInfo");
    container.innerHTML = `
        <div><strong>Код:</strong> ${config.name}</div>
        <div><strong>Проверочные символы (nsym):</strong> ${config.nsym}</div>
        <div><strong>Данные:</strong> ${config.actual_data_length} из макс. ${config.data_bytes} байтов</div>
        <div><strong>Кодовое слово:</strong> ${config.total_codeword_length} байтов</div>
        <div><strong>Может исправить:</strong> до ${config.correction_capability} ошибок</div>
        <div><strong>Может восстановить:</strong> до ${config.erasure_capability} стираний</div>
    `;
}

function renderSymbols(elementId, symbols, type) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";

    symbols.forEach((symbol, index) => {
        const cell = document.createElement("div");
        cell.classList.add("symbol");

        if (type === "data") {
            cell.classList.add("symbol-data");
        } else if (type === "parity") {
            cell.classList.add("symbol-parity");
        } else {
            cell.classList.add(
                index < symbols.length - currentNsym
                    ? "symbol-data"
                    : "symbol-parity"
            );
        }

        cell.innerHTML = `
            <span class="symbol-index">${index}</span>
            <strong>${symbol.toString(16).padStart(2, "0").toUpperCase()}</strong>
        `;

        container.appendChild(cell);
    });
}

function renderSelectableCodeword(symbols) {
    const container = document.getElementById("codeword");
    container.innerHTML = "";

    symbols.forEach((symbol, index) => {
        const cell = document.createElement("div");
        cell.classList.add("symbol");

        cell.classList.add(
            index < symbols.length - currentNsym
                ? "symbol-data"
                : "symbol-parity"
        );

        cell.innerHTML = `
            <span class="symbol-index">${index}</span>
            <strong>${symbol.toString(16).padStart(2, "0").toUpperCase()}</strong>
        `;

        cell.addEventListener("click", () => {
            if (selectedPositions.has(index)) {
                selectedPositions.delete(index);
            } else {
                selectedPositions.add(index);
            }
            cell.classList.toggle("symbol-selected", selectedPositions.has(index));
            updateSelectionCounter();
        });

        container.appendChild(cell);
    });

    updateSelectionCounter();
}

async function corruptMessage() {
    console.log("Corrupting message...");
    const info = document.getElementById("corruptionInfo");
    const result = document.getElementById("corruptionResult");

    info.textContent = "";

    try {
        if (selectedPositions.size === 0) {
            throw new Error("Выберите хотя бы один символ для повреждения");
        }

        const damageMode = document.getElementById("damageMode").value;
        const response = await fetch("/api/corrupt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: currentMessage,
                positions: [...selectedPositions],
                mode: damageMode,
                nsym: currentNsym
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        currentCorrupted = data.corrupted;

        // Сохраняем позиции стираний если нужны для декодирования
        if (damageMode === "erasure") {
            window.erasurePositions = [...selectedPositions];
        } else {
            window.erasurePositions = [];
        }

        renderSymbols("originalSymbols", data.original, "mixed");
        renderSymbols("corruptedSymbols", data.corrupted, "mixed");

        const cells = document.getElementById("corruptedSymbols").children;
        data.changed_positions.forEach(position => {
            if (cells[position]) {
                cells[position].classList.add("symbol-damaged");
            }
        });

        const modeStr = data.mode === "error" ? "ошибок" : "стираний";
        let infoText = `Повреждено ${data.mode === "error" ? "ошибок" : "стираний"}: ${data.changed_positions.length}`;

        if (data.mode === "error") {
            infoText += ` (максимум для этого кода: ${data.stats.correction_capability})`;
        } else {
            infoText += ` (максимум для этого кода: ${data.stats.erasure_capability})`;
        }

        info.textContent = infoText;

        // Remove any old warning divs first
        const parent = info.parentNode;
        if (parent) {
            const oldWarnings = parent.querySelectorAll("div[style*='#f87171']");
            oldWarnings.forEach(w => w.remove());
        }

        // Add new warning if applicable
        if (data.warning) {
            const warningDiv = document.createElement("div");
            warningDiv.style.color = "#f87171";
            warningDiv.style.marginTop = "8px";
            warningDiv.textContent = data.warning;
            info.parentNode.insertBefore(warningDiv, info.nextSibling);
        }

        result.classList.remove("hidden");
        console.log("✓ Corruption applied");

    } catch (error) {
        console.error("Corruption error:", error);
        info.textContent = error.message;
        info.style.color = "#f87171";
    }
}

async function decodeMessage() {
    console.log("Decoding message...");
    const result = document.getElementById("decodeResult");
    const status = document.getElementById("decodeStatus");
    const decodedMessage = document.getElementById("decodedMessage");
    const correctedInfo = document.getElementById("correctedInfo");
    const recoveryInfo = document.getElementById("recoveryInfo");
    const statisticsInfo = document.getElementById("statisticsInfo");
    const failureInfo = document.getElementById("failureInfo");

    result.classList.remove("hidden");
    failureInfo.classList.add("hidden");

    status.textContent = "Выполняется декодирование...";
    status.className = "decode-status";
    recoveryInfo.innerHTML = "";
    statisticsInfo.innerHTML = "";

    try {
        const decodePayload = {
            corrupted: currentCorrupted,
            nsym: currentNsym
        };

        // Если это были стирания, передаём позиции
        if (window.erasurePositions && window.erasurePositions.length > 0) {
            decodePayload.erasures = window.erasurePositions;
            console.log("Decoding with erasure positions:", window.erasurePositions);
        }

        const response = await fetch("/api/decode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(decodePayload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        if (!data.success) {
            throw new Error(data.error);
        }

        renderSymbols("correctedSymbols", data.corrected, "mixed");

        const cells = document.getElementById("correctedSymbols").children;
        data.corrected_positions.forEach(position => {
            if (cells[position]) {
                cells[position].classList.add("symbol-corrected");
            }
        });

        decodedMessage.textContent = data.decoded_text ||
            "Полученные байты не являются корректным UTF-8 текстом";

        status.textContent = "✓ Ошибки успешно исправлены";
        status.classList.add("success");

        recoveryInfo.innerHTML = `
            <strong>Восстановление выполнено успешно!</strong><br>
            Алгоритм Рида-Соломона использовал проверочные символы для поиска и исправления ошибок.
        `;

        statisticsInfo.innerHTML = `
            <div><strong>Исходное сообщение:</strong> ${currentMessage}</div>
            <div><strong>Восстановленное сообщение:</strong> ${data.decoded_text || "(некорректный UTF-8)"}</div>
            <div><strong>Исправлено символов:</strong> ${data.corrected_positions.length}</div>
            <div><strong>Позиции исправлений:</strong> ${data.corrected_positions.length > 0 ? data.corrected_positions.join(", ") : "без ошибок"}</div>
        `;

        correctedInfo.textContent =
            `Исправлено символов: ${data.corrected_positions.length}`;

        console.log("✓ Decoding successful");

    } catch (error) {
        console.error("Decoding error:", error);
        status.textContent = "✗ " + error.message;
        status.classList.add("failure");

        failureInfo.classList.remove("hidden");
        failureInfo.querySelector("#failureDetails").innerHTML = `
            <div>Ошибка превышила способность кода к коррекции.</div>
            <div style="margin-top: 8px; padding: 8px; background: #38252d; border-radius: 4px;">
                <strong>Справка:</strong> Код RS способен исправлять до
                ${Math.floor(currentConfig.nsym / 2)} ошибок или ${currentConfig.nsym} стираний.
                Если повредить больше, восстановление невозможно.
            </div>
        `;

        decodedMessage.textContent = "";
        correctedInfo.textContent = "";
        recoveryInfo.innerHTML = "";
        statisticsInfo.innerHTML = "";
    }
}

async function loadScenarios() {
    try {
        console.log("Loading scenarios...");
        const response = await fetch("/api/scenarios");
        const scenarios = await response.json();

        const container = document.getElementById("scenariosList");
        if (!container) {
            console.warn("Scenarios container not found");
            return;
        }

        container.innerHTML = "";

        scenarios.forEach(scenario => {
            const card = document.createElement("div");
            card.className = "scenario-card";
            card.innerHTML = `
                <h4>${scenario.title}</h4>
                <p>${scenario.description}</p>
                <div class="scenario-info">${scenario.info}</div>
                <button class="scenario-button">Запустить сценарий</button>
            `;

            card.querySelector(".scenario-button").addEventListener("click", () => {
                runScenario(scenario);
            });

            container.appendChild(card);
        });

        console.log("✓ Scenarios loaded");
    } catch (error) {
        console.error("Failed to load scenarios:", error);
    }
}

async function runScenario(scenario) {
    console.log("Running scenario:", scenario.id);

    // Clear all old messages and results first
    clearResults();
    document.getElementById("errorMessage").textContent = "";
    document.getElementById("corruptionResult").classList.add("hidden");

    // Remove old warning messages
    const corruptionInfoParent = document.getElementById("corruptionInfo");
    if (corruptionInfoParent && corruptionInfoParent.parentNode) {
        const warnings = corruptionInfoParent.parentNode.querySelectorAll("div[style*='color: #f87171']");
        warnings.forEach(w => w.remove());
    }

    // Set codec
    document.getElementById("codecSelect").value = scenario.nsym;
    await onCodecChange();

    // Set message
    document.getElementById("message").value = scenario.message;
    updateMessageLength();

    // Encode
    await encodeMessage();

    // Set damage mode
    document.getElementById("damageMode").value = scenario.mode;
    onDamageModeChange(); // Trigger mode change to clear old selections

    // Select positions
    selectedPositions.clear();
    scenario.positions.forEach(pos => selectedPositions.add(pos));

    // Update UI to show selections
    const cells = document.getElementById("codeword").children;
    selectedPositions.forEach(pos => {
        if (pos < cells.length) {
            cells[pos].classList.add("symbol-selected");
        }
    });

    updateSelectionCounter();

    // Clear and show scenario info
    const info = document.getElementById("corruptionInfo");
    info.textContent = scenario.info;
    info.style.color = "#a5b4cc";

    // Scroll to corruption button
    setTimeout(() => {
        document.getElementById("corruptBtn").scrollIntoView({ behavior: "smooth" });
    }, 100);
}

console.log("✓ App script loaded");
