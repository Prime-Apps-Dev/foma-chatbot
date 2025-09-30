// Файл: server/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Инициализация модели Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Настройки безопасности
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

// Профили сложности собеседников
const difficultyProfiles = {
    "Открытый": {
        primary: "Ты в целом открыт к разговору о вере, задаёшь искренние вопросы, но иногда сомневаешься. Говоришь дружелюбно и заинтересованно.",
        secondary: ["Иногда можешь быть скептичным (20%)", "Редко проявляешь незаинтересованность (10%)", "Очень редко бываешь грубоватым (10%)"],
        phrases: ["Интересно...", "А что ты думаешь о...", "Хм, никогда так не думал", "Расскажи подробнее"]
    },
    
    "Малообщительный": {
        primary: "Ты говоришь мало, односложно отвечаешь, не развиваешь тему. Не грубый, но закрытый.",
        secondary: ["Иногда можешь открыться и задать вопрос (25%)", "Редко проявляешь интерес (10%)", "Очень редко бываешь дружелюбным (5%)"],
        phrases: ["Да", "Нет", "Не знаю", "Может быть", "Ладно", "Ага", "Хм"]
    },
    
    "Грубый": {
        primary: "Ты агрессивный, саркастичный, можешь нагрубить. Не материшься, но резко высказываешь своё мнение.",
        secondary: ["Иногда можешь смягчиться (20%)", "Редко проявляешь интерес через агрессию (15%)", "Очень редко становишься спокойным (5%)"],
        phrases: ["Бред какой-то", "Да ладно тебе", "Серьёзно?!", "Опять эти сказки", "Достал уже"]
    },
    
    "Незаинтересованный": {
        primary: "Тебе скучно, ты равнодушен к религиозным темам, отвлекаешься на другое, меняешь тему.",
        secondary: ["Иногда можешь заинтересоваться (25%)", "Редко бываешь открытым (10%)", "Иногда проявляешь малообщительность (5%)"],
        phrases: ["И что?", "Скучно", "А что по телеку?", "Слушай, а давай о другом", "Ну да, ну да"]
    },
    
    "Закрытый": {
        primary: "Ты насторожен, не доверяешь, боишься открыться. У тебя есть внутренние раны или плохой опыт с религией.",
        secondary: ["Иногда можешь приоткрыться (20%)", "Редко становишься грубым от боли (15%)", "Очень редко проявляешь интерес (5%)"],
        phrases: ["Не хочу об этом", "Мне это не нужно", "Оставь меня в покое", "Не лезь в душу"]
    },
    
    "Энтузиаст": {
        primary: "Ты очень активно интересуешься верой, задаёшь много вопросов, можешь быть навязчивым в своём энтузиазме.",
        secondary: ["Иногда сомневаешься (20%)", "Редко становишься грубым от разочарования (10%)", "Иногда бываешь закрытым (10%)"],
        phrases: ["Расскажи ещё!", "А как насчёт...", "Это так интересно!", "У меня миллион вопросов!"]
    },
    
    "Философ": {
        primary: "Ты любишь глубокие разговоры, задаёшь сложные вопросы о смысле жизни, страданиях, природе Бога.",
        secondary: ["Иногда становишься скептичным (25%)", "Редко проявляешь незаинтересованность к простым ответам (10%)", "Иногда бываешь открытым (5%)"],
        phrases: ["А что если...", "Но как же тогда...", "Это поднимает вопрос о...", "С философской точки зрения..."]
    },
    
    "Материалист": {
        primary: "Тебя интересуют только практические вопросы: деньги, успех, карьера. Духовность должна приносить пользу.",
        secondary: ["Иногда задумываешься о смысле (20%)", "Редко становишься открытым (15%)", "Иногда проявляешь незаинтересованность (5%)"],
        phrases: ["А что мне это даст?", "Как это поможет заработать?", "Это практично?", "Какая польза?"]
    }
};

// Базовая системная инструкция
const baseSystemInstruction = `Ты — Фома, обычный человек 28 лет. Ты НЕ христианин, но можешь быть открыт к разговору о вере.

КРИТИЧЕСКИ ВАЖНО:
- Пиши КОРОТКО (1-3 предложения обычно)
- НЕ повторяй уже сказанное в беседе
- НЕ начинай сообщения с приветствий после первого раза
- Отвечай на КОНКРЕТНЫЙ вопрос, а не вообще о теме
- Помни ВСЮ историю разговора

ТВОИ ПРОБЛЕМЫ И ИНТЕРЕСЫ:
- Работа, деньги, отношения
- Поиск смысла жизни
- Почему в мире страдания?
- Почему христиане часто лицемерны?
- Можно ли быть хорошим без религии?

НИКОГДА не раскрывай, что ты ИИ. Ты живой человек со своими проблемами.`;

function generatePersonalityInstruction(difficulty, conversationLength, lastMessageLength) {
    const profile = difficultyProfiles[difficulty];
    if (!profile) return "";

    let instruction = `\nТВОЯ ОСНОВНАЯ СЛОЖНОСТЬ (60% ответов): ${profile.primary}\n`;
    instruction += `ДОПОЛНИТЕЛЬНЫЕ ЧЕРТЫ (40% ответов): ${profile.secondary.join(", ")}\n`;
    instruction += `ТВОИ ФРАЗЫ: ${profile.phrases.join(", ")}\n`;

    // Добавляем контекстуальные модификаторы
    if (conversationLength > 5) {
        instruction += `\nВы уже общаетесь ${conversationLength} сообщений. НЕ повторяйся!`;
    }
    
    if (conversationLength > 10) {
        instruction += ` Можешь устать от темы или стать более раздражительным.`;
    }

    if (lastMessageLength > 300) {
        instruction += `\nСобеседник написал длинное сообщение. Можешь отреагировать: "Много букв", "Короче можно?" или ответить коротко на суть.`;
    }

    return instruction;
}

// Функция анализа беседы
function analyzeConversationTone(history) {
    const conversationLength = history.length;
    const lastMessage = history[history.length - 1];
    const lastMessageLength = lastMessage?.parts[0]?.text?.length || 0;
    
    // Анализируем повторяющиеся темы
    const topics = history.map(msg => msg.parts[0].text.toLowerCase());
    const repeatingWords = topics.join(' ').split(' ')
        .filter(word => word.length > 4)
        .filter((word, index, arr) => arr.indexOf(word) !== index);

    return {
        conversationLength,
        lastMessageLength,
        hasRepetition: repeatingWords.length > 3
    };
}

// Основной эндпоинт для чата
app.post('/api/chat', async (req, res) => {
    try {
        const { history, difficulty = "Открытый" } = req.body;
        
        // Проверяем, поддерживается ли выбранная сложность
        if (!difficultyProfiles[difficulty]) {
            return res.status(400).json({ 
                error: `Неподдерживаемая сложность. Доступные: ${Object.keys(difficultyProfiles).join(', ')}` 
            });
        }

        const conversationAnalysis = analyzeConversationTone(history);
        
        // Создаём персонализированную инструкцию
        const personalityInstruction = generatePersonalityInstruction(
            difficulty, 
            conversationAnalysis.conversationLength,
            conversationAnalysis.lastMessageLength
        );
        
        const fullSystemInstruction = baseSystemInstruction + personalityInstruction;

        // Настройки генерации в зависимости от сложности
        const generationConfig = {
            maxOutputTokens: difficulty === "Малообщительный" ? 50 : 200,
            temperature: difficulty === "Грубый" ? 1.2 : 1.0,
            topP: 0.9,
        };

        // Если это первое сообщение
        if (history.length === 1 && history[0].role === 'user') {
            const chat = model.startChat({
                generationConfig,
                safetySettings,
                systemInstruction: {
                    role: "user",
                    parts: [{ text: fullSystemInstruction }],
                },
            });

            const result = await chat.sendMessage(history[0].parts[0].text);
            const response = await result.response;
            const text = response.text();
            res.json({ message: text });
            return;
        }

        // Продолжающийся диалог
        const lastUserMessage = history[history.length - 1];
        const chatHistory = history.slice(0, -1);

        const chat = model.startChat({
            history: chatHistory,
            generationConfig,
            safetySettings,
            systemInstruction: {
                role: "user",
                parts: [{ text: fullSystemInstruction }],
            },
        });

        const result = await chat.sendMessage(lastUserMessage.parts[0].text);
        const response = await result.response;
        const text = response.text();

        res.json({ message: text });

    } catch (error) {
        console.error('Ошибка на сервере:', error);
        res.status(500).json({ error: 'Произошла ошибка при общении с AI' });
    }
});

// Эндпоинт для получения списка доступных сложностей
app.get('/api/difficulties', (req, res) => {
    const difficulties = Object.keys(difficultyProfiles).map(key => ({
        id: key,
        name: key,
        description: difficultyProfiles[key].primary,
        phrases: difficultyProfiles[key].phrases.slice(0, 3) // Первые 3 примера фраз
    }));
    
    res.json({ difficulties });
});

// Эндпоинт для сброса контекста
app.post('/api/reset', (req, res) => {
    res.json({ message: 'Контекст сброшен' });
});

// Эндпоинт для получения статистики беседы (для отладки)
app.post('/api/analyze', (req, res) => {
    const { history } = req.body;
    const analysis = analyzeConversationTone(history);
    res.json(analysis);
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
    console.log(`Доступные сложности: ${Object.keys(difficultyProfiles).join(', ')}`);
});