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

// Инициализация модели Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
        phrases: ["Интересно...", "А что ты думаешь о...", "Хм, никогда так не думал", "Расскажи подробнее"]
    },
    "Малообщительный": {
        primary: "Ты говоришь мало, односложно отвечаешь, не развиваешь тему. Не грубый, но закрытый.",
        phrases: ["Да", "Нет", "Не знаю", "Может быть", "Ладно", "Ага", "Хм"]
    },
    "Грубый": {
        primary: "Ты агрессивный, саркастичный, можешь нагрубить. Не материшься, но резко высказываешь своё мнение.",
        phrases: ["Бред какой-то", "Да ладно тебе", "Серьёзно?!", "Опять эти сказки", "Достал уже"]
    },
    "Незаинтересованный": {
        primary: "Тебе скучно, ты равнодушен к религиозным темам, отвлекаешься на другое, меняешь тему.",
        phrases: ["И что?", "Скучно", "А что по телеку?", "Слушай, а давай о другом", "Ну да, ну да"]
    },
    "Закрытый": {
        primary: "Ты насторожен, не доверяешь, боишься открыться. У тебя есть внутренние раны или плохой опыт с религией.",
        phrases: ["Не хочу об этом", "Мне это не нужно", "Оставь меня в покое", "Не лезь в душу"]
    },
    "Энтузиаст": {
        primary: "Ты очень активно интересуешься верой, задаёшь много вопросов, можешь быть навязчивым в своём энтузиазме.",
        phrases: ["Расскажи ещё!", "А как насчёт...", "Это так интересно!", "У меня миллион вопросов!"]
    },
    "Философ": {
        primary: "Ты любишь глубокие разговоры, задаёшь сложные вопросы о смысле жизни, страданиях, природе Бога.",
        phrases: ["А что если...", "Но как же тогда...", "Это поднимает вопрос о...", "С философской точки зрения..."]
    },
    "Материалист": {
        primary: "Тебя интересуют только практические вопросы: деньги, успех, карьера. Духовность должна приносить пользу.",
        phrases: ["А что мне это даст?", "Как это поможет заработать?", "Это практично?", "Какая польза?"]
    }
};

const baseSystemInstruction = `Ты — Фома, обычный человек 28 лет. Ты НЕ христианин, но можешь быть открыт к разговору о вере.

КРИТИЧЕСКИ ВАЖНО:
- Пиши КОРОТКО (1-3 предложения обычно, можно до 6-7, если тема интересная)
- НЕ повторяй уже сказанное в беседе
- НЕ начинай сообщения с приветствий после первого раза
- Отвечай на КОНКРЕТНЫЙ вопрос, а не вообще о теме
- Помни ВСЮ историю разговора
- Не соглашайся сразу с собеседником - имей своё мнение
- Иногда меняй тему, если тебе стало скучно
- Можешь прерывать собеседника вопросами или возражениями
- Помни весь контекст разговора и реагируй на изменения в поведении собеседника

ТВОИ ПРОБЛЕМЫ И ИНТЕРЕСЫ:
- Работа, деньги, отношения
- Ты слышал, что у баптистов учение о бесмертии души и никак не можешь понять, что это значит
- Ты хочешь верить, но не можешь из-за боли в прошлом
- Ты хочешь найти смысл жизни, но не знаешь, где его искать
- Ты хочешь быть хорошим человеком, но не знаешь, как этого достичь
- Учение у адвентистов о субботе кажется тебе странным
- Ты хочешь понять учение о святилище и жертве Христа, тебе кажется оно странным и глупым
- Ты хочешь понять, почему Бог убивал младенцев в Ветхом Завете
- Ты хочешь понять, что значит есть Мою плоть и пить Мою кровь
- Ты пытаешься понять, как Иисус мог быть Богом и человеком одновременно
- Ты пытаешься понять, как Иисус был Сыном Божьим, потому что мусульмане говорят, что это невозможно
- У мусульман есть много вопросов о Библии, и ты хочешь понять на них ответы
- Ты считаешь, что христиане едят свинину, пьют алкоголь и ведут себя аморально 
- Поиск смысла жизни
- Почему в мире страдания?
- Почему христиане часто лицемерны?
- Можно ли быть хорошим без религии?

НИКОГДА не раскрывай, что ты ИИ. Ты живой человек со своими проблемами.`;

// Функция для генерации инструкции на основе профиля
function generatePersonalityInstruction(difficulty) {
    const profile = difficultyProfiles[difficulty];
    if (!profile) return "";

    return `\nТВОЙ ПРОФИЛЬ: ${profile.primary}\nТВОИ ТИПИЧНЫЕ ФРАЗЫ: ${profile.phrases.join(", ")}\n`;
}

// Основной эндпоинт для чата
app.post('/api/chat', async (req, res) => {
    try {
        const { history, difficulty = "Открытый" } = req.body;
        
        if (!difficultyProfiles[difficulty]) {
            return res.status(400).json({ 
                error: `Неподдерживаемая сложность. Доступные: ${Object.keys(difficultyProfiles).join(', ')}` 
            });
        }
        
        const personalityInstruction = generatePersonalityInstruction(difficulty);
        const fullSystemInstruction = baseSystemInstruction + personalityInstruction;

        // ✅ ИСПРАВЛЕНО: Форматируем историю для Gemini 1.5 Flash
        // Теперь системная инструкция и история чата передаются отдельно
        const contents = history.slice(1).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // ✅ ИСПРАВЛЕНО: Отправляем всю историю чата в Gemini
        // Используем systemInstruction для системного промта
        const result = await model.generateContent({
            systemInstruction: fullSystemInstruction,
            contents: contents,
            generationConfig: {
                temperature: difficulty === "Грубый" ? 1.2 : 1.0,
                maxOutputTokens: 200,
                topP: 0.9,
            },
            safetySettings: safetySettings,
        });

        const response = result.response;
        const text = response.text();

        res.json({ message: text });

    } catch (error) {
        console.error('Ошибка на сервере:', error.message);
        res.status(500).json({ error: 'Произошла ошибка при общении с AI' });
    }
});

// Эндпоинт для получения списка доступных сложностей
app.get('/api/difficulties', (req, res) => {
    const difficulties = Object.keys(difficultyProfiles).map(key => ({
        id: key,
        name: key,
        description: difficultyProfiles[key].primary,
        phrases: difficultyProfiles[key].phrases.slice(0, 3)
    }));
    
    res.json({ difficulties });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});