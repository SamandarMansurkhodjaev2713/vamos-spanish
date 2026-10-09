/* Contextual reading. Original recordings are played whole, never synthesized or cut. */
window.VamosReader={create(api){
 'use strict';
 const {data,state,esc,icon,mascot,playButton,audioControls,audioStatus,audioCredit,footer,save,render,toast,playSequence}=api;
 const norm=s=>String(s??'').normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 const split=s=>String(s).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean)||[];
 const words=data.library.items.filter(x=>x.type==='word');
 const dictionary=new Map(words.map(w=>[norm(w.es),w]));
 const properNames={Andrea:'Андреа — имя',Leo:'Лео — имя',Julia:'Хулия — имя',Mar:'Мар — имя',Pablo:'Пабло — имя',Ana:'Ана — имя',Marta:'Марта — имя'};
 // Contextual additions for the original short scenes, including names and articles.
 const additions={eres:'ты родом / ты являешься (форма ser)',brasil:'Бразилия',rusia:'Россия',ruso:'русский язык',amélie:'«Амели» — название фильма',coco:'«Тайна Коко» — название фильма в этой сцене',por:'по / в; por la mañana — «утром», por la tarde — «после полудня»',haces:'ты делаешь',leo:'я читаю (форма leer; Leo с заглавной буквы — имя Лео)',fin:'конец; fin de semana — «выходные»',estás:'ты находишься / чувствуешь себя (форма estar)',favor:'в por favor: «пожалуйста»',está:'находится / сейчас в таком состоянии',sí:'да',perfecto:'отлично',llega:'приходит / приезжает',pequeña:'маленькая',tiene:'имеет / у него или неё есть',para:'для / чтобы / в направлении',del:'de + el: от / из / рядом с — по контексту',al:'a + el: к / в',tu:'твой / твоя (без ударения; tú — «ты»)',responde:'отвечает',lugar:'место',quieren:'они хотят',dice:'говорит',museo:'музей',que:'что / который — по контексту',plan:'план',buen:'хороший (перед существительным мужского рода)',puedes:'ты можешь',otra:'другая',o:'или',mira:'посмотри / смотрит',andrea:'Андреа — имя',el:'определённый артикль мужского рода',es:'это / является (форма ser)',francés:'французский язык',gusto:'удовольствие; mucho gusto — «очень приятно»',inglés:'английский язык',la:'определённый артикль женского рода',moscú:'Москва',más:'больше; más despacio — «медленнее»',nos:'нас / нам; nos vemos — «увидимся»',pie:'нога / стопа; a pie — «пешком»',poco:'немного',podrías:'мог бы / могла бы (вежливая просьба)',pop:'поп-музыка',trabajé:'я работал / работала (завершённый факт в прошлом)',una:'неопределённый артикль женского рода',vas:'ты идёшь; vas a hacer — «собираешься делать»',ven:'приходи (обращение на ты)',y:'и / а',yo:'я'};
 const phraseGloss=[{es:'me llamo',ru:'меня зовут'},{es:'mucho gusto',ru:'очень приятно'},{es:'a pie',ru:'пешком'},{es:'de acuerdo',ru:'согласен / согласна; договорились'},{es:'hasta luego',ru:'до встречи'},{es:'nos vemos',ru:'увидимся'},{es:'lo siento',ru:'мне жаль / извини'}];
 const authoredThemes={'a1-home':'Дом и люди','a1-trip':'Город и дорога','a1-shop':'Покупки','a2-routine':'Обычный день','a2-weekend':'Досуг и планы','a2-return':'Покупки','b1-move':'Дом и люди','b1-study':'Учёба','b2-library':'Город и общество','c1-memory':'Город и общество'};
 const nativeThemes={'text:1':'Знакомство','text:2':'Знакомство','text:3':'Учёба','text:4':'Досуг и планы','text:5':'Досуг и планы','text:6':'Кафе и встречи','text:7':'Язык и помощь','text:8':'Обычный день','text:9':'Досуг и планы','text:10':'Обычный день','text:11':'Кафе и встречи','text:12':'Знакомство'};
 const native=data.library.items.filter(x=>x.type==='text').map(x=>({...x,kind:'native',level:x.day===1?'starter':'A1',theme:nativeThemes[x.id]||x.topic,minutes:Math.max(3,Math.ceil(x.lines.length*.8)),task:{prompt:x.question,options:x.options,answer:x.answer,feedback:x.feedback},glossary:phraseGloss}));
 const authored=(data.pathway?.readings||[]).map(x=>{
  const es=split(x.text),ru=split(x.translation),aligned=es.length===ru.length;
  const task=x.tasks.find(t=>t.kind==='choice');
  return {...x,id:'reading:'+x.id,sourceId:x.id,kind:'authored',level:x.level,theme:authoredThemes[x.id]||'Другие темы',minutes:Math.max(5,Math.ceil(x.text.split(/\s+/).length/18)+3),es:x.text,ru:x.translation,format:'История',lines:aligned?es.map((s,i)=>({es:s,ru:ru[i],speaker:null,audio:null})):[{es:x.text,ru:x.translation,speaker:null,audio:null}],task:task?{prompt:task.prompt,options:task.options,answer:task.answer,feedback:task.explanation}:null,mission:'Перескажи главную мысль одной или двумя фразами своими словами.'};
 });
 const course=(data.stories?.days||[]).map(x=>{const q=x.questions[0];return {...x,id:'story:'+x.day,kind:'course',level:x.day===1?'starter':'A1',theme:data.stories.chapters.find(c=>c.id===x.chapter)?.title||'По дням курса',minutes:7,format:'Диалог',es:x.lines.map(l=>l.es).join(' '),ru:x.lines.map(l=>l.ru).join(' '),lines:x.lines.map(l=>({...l,speaker:l.role})),task:{prompt:q.prompt,options:q.options,answer:q.answer,feedback:q.explanation},mission:x.own.prompt};});
 const collectionTexts=[
  {
    "id": "serial:ana:1",
    "kind": "serial",
    "series": "Первый день Аны",
    "chapter": 1,
    "chapters": 3,
    "title": "Новая соседка",
    "level": "A1",
    "theme": "Дом и люди",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Ana vive en Madrid. Hoy conoce a su nueva vecina, Clara. —Hola, soy Ana. Vivo aquí. —Mucho gusto. ¿Quieres un café? Ana acepta y entra en la cocina.",
    "ru": "Ана живёт в Мадриде. Сегодня она знакомится со своей новой соседкой Кларой. —Привет, я Ана. Я живу здесь. —Очень приятно. Хочешь кофе? Ана соглашается и входит на кухню.",
    "lines": [
      {
        "es": "Ana vive en Madrid.",
        "ru": "Ана живёт в Мадриде.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Hoy conoce a su nueva vecina, Clara.",
        "ru": "Сегодня она знакомится со своей новой соседкой Кларой.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Hola, soy Ana. Vivo aquí.",
        "ru": "—Привет, я Ана. Я живу здесь.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Mucho gusto. ¿Quieres un café?",
        "ru": "—Очень приятно. Хочешь кофе?",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Ana acepta y entra en la cocina.",
        "ru": "Ана соглашается и входит на кухню.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Что предлагает Клара?",
      "options": [
        "Показать город",
        "Выпить кофе",
        "Купить квартиру"
      ],
      "answer": 1,
      "feedback": "Клара спрашивает «¿Quieres un café?» — она предлагает кофе."
    },
    "mission": "Представься новой соседке и ответь на приглашение выпить кофе.",
    "glossary": [
      {
        "es": "vive",
        "ru": "живёт"
      },
      {
        "es": "conoce",
        "ru": "знакомится с / знает"
      },
      {
        "es": "su",
        "ru": "её / его / ваш"
      },
      {
        "es": "nueva",
        "ru": "новая"
      },
      {
        "es": "vecina",
        "ru": "соседка"
      },
      {
        "es": "aquí",
        "ru": "здесь"
      },
      {
        "es": "quieres",
        "ru": "ты хочешь"
      },
      {
        "es": "acepta",
        "ru": "соглашается"
      },
      {
        "es": "entra",
        "ru": "входит"
      },
      {
        "es": "cocina",
        "ru": "кухня"
      },
      {
        "es": "Madrid",
        "ru": "Мадрид — город"
      },
      {
        "es": "Clara",
        "ru": "Клара — имя"
      }
    ],
    "nextChapter": "serial:ana:2"
  },
  {
    "id": "serial:ana:2",
    "kind": "serial",
    "series": "Первый день Аны",
    "chapter": 2,
    "chapters": 3,
    "title": "На рынке",
    "level": "A1",
    "theme": "Покупки",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Clara y Ana van al mercado. Ana quiere dos manzanas y un poco de pan. —¿Cuánto cuesta el pan? —Dos euros —responde el vendedor. Ana paga y dice: «Gracias, hasta luego».",
    "ru": "Клара и Ана идут на рынок. Ана хочет два яблока и немного хлеба. —Сколько стоит хлеб? —Два евро, —отвечает продавец. Ана платит и говорит: «Спасибо, до встречи».",
    "lines": [
      {
        "es": "Clara y Ana van al mercado.",
        "ru": "Клара и Ана идут на рынок.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Ana quiere dos manzanas y un poco de pan.",
        "ru": "Ана хочет два яблока и немного хлеба.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—¿Cuánto cuesta el pan?",
        "ru": "—Сколько стоит хлеб?",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Dos euros —responde el vendedor.",
        "ru": "—Два евро, —отвечает продавец.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Ana paga y dice: «Gracias, hasta luego».",
        "ru": "Ана платит и говорит: «Спасибо, до встречи».",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Сколько стоит хлеб?",
      "options": [
        "Два евро",
        "Три евро",
        "Один евро"
      ],
      "answer": 0,
      "feedback": "Продавец отвечает «Dos euros». Число относится к цене хлеба, а не к яблокам."
    },
    "mission": "Попроси хлеб, спроси цену и поблагодари продавца.",
    "glossary": [
      {
        "es": "van",
        "ru": "они идут"
      },
      {
        "es": "al mercado",
        "ru": "на рынок"
      },
      {
        "es": "quiere",
        "ru": "хочет"
      },
      {
        "es": "manzanas",
        "ru": "яблоки"
      },
      {
        "es": "un poco de",
        "ru": "немного"
      },
      {
        "es": "pan",
        "ru": "хлеб"
      },
      {
        "es": "cuánto cuesta",
        "ru": "сколько стоит"
      },
      {
        "es": "euros",
        "ru": "евро"
      },
      {
        "es": "responde",
        "ru": "отвечает"
      },
      {
        "es": "vendedor",
        "ru": "продавец"
      },
      {
        "es": "paga",
        "ru": "платит"
      },
      {
        "es": "dice",
        "ru": "говорит"
      },
      {
        "es": "Clara",
        "ru": "Клара — имя"
      }
    ],
    "nextChapter": "serial:ana:3"
  },
  {
    "id": "serial:ana:3",
    "kind": "serial",
    "series": "Первый день Аны",
    "chapter": 3,
    "chapters": 3,
    "title": "Вечер на площади",
    "level": "A1",
    "theme": "Досуг и планы",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Por la tarde, Ana está en la plaza. Clara llega con su perro. —¿Te gusta Madrid? —Sí, me gusta mucho. Mañana quiero pasear por el centro. —Perfecto. Nos vemos aquí a las diez.",
    "ru": "Во второй половине дня Ана на площади. Клара приходит со своей собакой. —Тебе нравится Мадрид? —Да, мне очень нравится. Завтра я хочу погулять по центру. —Отлично. Увидимся здесь в десять.",
    "lines": [
      {
        "es": "Por la tarde, Ana está en la plaza.",
        "ru": "Во второй половине дня Ана на площади.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Clara llega con su perro.",
        "ru": "Клара приходит со своей собакой.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—¿Te gusta Madrid?",
        "ru": "—Тебе нравится Мадрид?",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Sí, me gusta mucho. Mañana quiero pasear por el centro.",
        "ru": "—Да, мне очень нравится. Завтра я хочу погулять по центру.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Perfecto. Nos vemos aquí a las diez.",
        "ru": "—Отлично. Увидимся здесь в десять.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Когда они договариваются встретиться?",
      "options": [
        "Сегодня в десять",
        "Завтра в десять",
        "Завтра вечером"
      ],
      "answer": 1,
      "feedback": "Ана говорит «Mañana», а Клара добавляет «a las diez»: завтра в десять."
    },
    "mission": "Скажи, что тебе нравится в городе, и договорись о встрече завтра.",
    "glossary": [
      {
        "es": "por la tarde",
        "ru": "во второй половине дня / ближе к вечеру"
      },
      {
        "es": "plaza",
        "ru": "площадь"
      },
      {
        "es": "llega",
        "ru": "приходит / приезжает"
      },
      {
        "es": "perro",
        "ru": "собака"
      },
      {
        "es": "te gusta",
        "ru": "тебе нравится"
      },
      {
        "es": "me gusta mucho",
        "ru": "мне очень нравится"
      },
      {
        "es": "pasear",
        "ru": "гулять"
      },
      {
        "es": "por el centro",
        "ru": "по центру"
      },
      {
        "es": "a las diez",
        "ru": "в десять"
      },
      {
        "es": "Madrid",
        "ru": "Мадрид — город"
      },
      {
        "es": "Clara",
        "ru": "Клара — имя"
      }
    ],
    "nextChapter": null
  },
  {
    "id": "serial:leo:1",
    "kind": "serial",
    "series": "Поездка Лео",
    "chapter": 1,
    "chapters": 3,
    "title": "Поезд и новая встреча",
    "level": "A2",
    "theme": "Город и дорога",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Leo llega a la estación con una mochila pequeña. Tiene un billete para Valencia, pero no sabe de qué andén sale el tren. Pregunta a una mujer y ella le muestra la pantalla. —El tren sale del andén cuatro, dentro de diez minutos. Leo le da las gracias y camina hacia el andén. Ya no tiene prisa: está en el lugar correcto.",
    "ru": "Лео приходит на вокзал с маленьким рюкзаком. У него билет в Валенсию, но он не знает, с какой платформы отправляется поезд. Он спрашивает женщину, и она показывает ему табло. —Поезд отправляется с четвёртой платформы через десять минут. Лео благодарит её и идёт к платформе. Он больше не спешит: он в нужном месте.",
    "lines": [
      {
        "es": "Leo llega a la estación con una mochila pequeña.",
        "ru": "Лео приходит на вокзал с маленьким рюкзаком.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Tiene un billete para Valencia, pero no sabe de qué andén sale el tren.",
        "ru": "У него билет в Валенсию, но он не знает, с какой платформы отправляется поезд.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Pregunta a una mujer y ella le muestra la pantalla.",
        "ru": "Он спрашивает женщину, и она показывает ему табло.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—El tren sale del andén cuatro, dentro de diez minutos.",
        "ru": "—Поезд отправляется с четвёртой платформы через десять минут.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Leo le da las gracias y camina hacia el andén.",
        "ru": "Лео благодарит её и идёт к платформе.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Ya no tiene prisa: está en el lugar correcto.",
        "ru": "Он больше не спешит: он в нужном месте.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Почему Лео перестаёт спешить?",
      "options": [
        "Поезд отменили",
        "Он нашёл нужную платформу",
        "Он решил остаться дома"
      ],
      "answer": 1,
      "feedback": "Женщина показала табло, Лео нашёл четвёртую платформу. «Está en el lugar correcto» объясняет, почему он больше не спешит."
    },
    "mission": "Спроси, с какой платформы отправляется поезд, и повтори ответ своими словами.",
    "glossary": [
      {
        "es": "estación",
        "ru": "вокзал / станция"
      },
      {
        "es": "mochila",
        "ru": "рюкзак"
      },
      {
        "es": "billete",
        "ru": "билет"
      },
      {
        "es": "sabe",
        "ru": "знает"
      },
      {
        "es": "de qué andén",
        "ru": "с какой платформы"
      },
      {
        "es": "sale",
        "ru": "отправляется / выходит"
      },
      {
        "es": "tren",
        "ru": "поезд"
      },
      {
        "es": "pregunta",
        "ru": "спрашивает"
      },
      {
        "es": "ella",
        "ru": "она"
      },
      {
        "es": "le muestra",
        "ru": "показывает ему"
      },
      {
        "es": "pantalla",
        "ru": "экран / табло"
      },
      {
        "es": "dentro de diez minutos",
        "ru": "через десять минут"
      },
      {
        "es": "le da las gracias",
        "ru": "благодарит её"
      },
      {
        "es": "camina",
        "ru": "идёт пешком"
      },
      {
        "es": "hacia",
        "ru": "к / в направлении"
      },
      {
        "es": "ya no",
        "ru": "уже не / больше не"
      },
      {
        "es": "tiene prisa",
        "ru": "спешит"
      },
      {
        "es": "lugar correcto",
        "ru": "нужное место"
      },
      {
        "es": "Valencia",
        "ru": "Валенсия — город"
      }
    ],
    "nextChapter": "serial:leo:2"
  },
  {
    "id": "serial:leo:2",
    "kind": "serial",
    "series": "Поездка Лео",
    "chapter": 2,
    "chapters": 3,
    "title": "Комната без ключа",
    "level": "A2",
    "theme": "Дом и люди",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Después del viaje, Leo llega al apartamento de su amiga Marta. Marta todavía está trabajando y Leo no tiene la llave. Le manda un mensaje: «Estoy delante de tu casa. ¿Qué hago?». Marta responde: «Espera en el café de la esquina. Llego en veinte minutos». Leo pide agua y se sienta junto a la ventana. Mientras espera, mira el mapa y elige un lugar para cenar.",
    "ru": "После поездки Лео приходит к квартире своей подруги Марты. Марта ещё работает, а у Лео нет ключа. Он отправляет ей сообщение: «Я перед твоим домом. Что мне делать?».  Марта отвечает: «Подожди в кафе на углу. Я приду через двадцать минут».  Лео заказывает воду и садится у окна. Пока он ждёт, он смотрит карту и выбирает место для ужина.",
    "lines": [
      {
        "es": "Después del viaje, Leo llega al apartamento de su amiga Marta.",
        "ru": "После поездки Лео приходит к квартире своей подруги Марты.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Marta todavía está trabajando y Leo no tiene la llave.",
        "ru": "Марта ещё работает, а у Лео нет ключа.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Le manda un mensaje: «Estoy delante de tu casa. ¿Qué hago?».",
        "ru": "Он отправляет ей сообщение: «Я перед твоим домом. Что мне делать?».",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Marta responde: «Espera en el café de la esquina. Llego en veinte minutos».",
        "ru": "Марта отвечает: «Подожди в кафе на углу. Я приду через двадцать минут».",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Leo pide agua y se sienta junto a la ventana.",
        "ru": "Лео заказывает воду и садится у окна.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Mientras espera, mira el mapa y elige un lugar para cenar.",
        "ru": "Пока он ждёт, он смотрит карту и выбирает место для ужина.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Что Марта просит сделать Лео?",
      "options": [
        "Подождать в кафе",
        "Позвонить соседке",
        "Купить новый ключ"
      ],
      "answer": 0,
      "feedback": "Марта пишет «Espera en el café de la esquina». Она не предлагает делать новый ключ."
    },
    "mission": "Объясни другу, где ты находишься, и спроси, что делать до его прихода.",
    "glossary": [
      {
        "es": "después del viaje",
        "ru": "после поездки"
      },
      {
        "es": "apartamento",
        "ru": "квартира"
      },
      {
        "es": "su amiga",
        "ru": "его подруга"
      },
      {
        "es": "todavía",
        "ru": "ещё / всё ещё"
      },
      {
        "es": "está trabajando",
        "ru": "работает сейчас"
      },
      {
        "es": "llave",
        "ru": "ключ"
      },
      {
        "es": "le manda",
        "ru": "отправляет ей"
      },
      {
        "es": "mensaje",
        "ru": "сообщение"
      },
      {
        "es": "delante de",
        "ru": "перед"
      },
      {
        "es": "qué hago",
        "ru": "что мне делать"
      },
      {
        "es": "espera",
        "ru": "подожди / ждёт"
      },
      {
        "es": "esquina",
        "ru": "угол улицы"
      },
      {
        "es": "llego",
        "ru": "я прихожу / приезжаю"
      },
      {
        "es": "en veinte minutos",
        "ru": "через двадцать минут"
      },
      {
        "es": "pide",
        "ru": "просит / заказывает"
      },
      {
        "es": "se sienta",
        "ru": "садится"
      },
      {
        "es": "junto a",
        "ru": "рядом с / у"
      },
      {
        "es": "ventana",
        "ru": "окно"
      },
      {
        "es": "mientras",
        "ru": "пока / в то время как"
      },
      {
        "es": "mira",
        "ru": "смотрит"
      },
      {
        "es": "mapa",
        "ru": "карта"
      },
      {
        "es": "elige",
        "ru": "выбирает"
      },
      {
        "es": "cenar",
        "ru": "ужинать"
      }
    ],
    "nextChapter": "serial:leo:3"
  },
  {
    "id": "serial:leo:3",
    "kind": "serial",
    "series": "Поездка Лео",
    "chapter": 3,
    "chapters": 3,
    "title": "Планы меняются",
    "level": "A2",
    "theme": "Досуг и планы",
    "minutes": 6,
    "format": "История",
    "formatId": "story",
    "es": "Al día siguiente, Leo y Marta quieren visitar la playa. Sin embargo, empieza a llover y deciden cambiar el plan. —Podemos ir al museo —propone Marta. —Buena idea, pero primero quiero desayunar —dice Leo. Buscan una cafetería cerca del museo y comparten una tortilla. Leo piensa que un plan nuevo también puede ser un buen plan.",
    "ru": "На следующий день Лео и Марта хотят сходить на пляж. Однако начинается дождь, и они решают изменить план. —Можем пойти в музей, —предлагает Марта. —Хорошая идея, но сначала я хочу позавтракать, —говорит Лео. Они ищут кафе рядом с музеем и делят одну тортилью. Лео думает, что новый план тоже может быть хорошим.",
    "lines": [
      {
        "es": "Al día siguiente, Leo y Marta quieren visitar la playa.",
        "ru": "На следующий день Лео и Марта хотят сходить на пляж.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Sin embargo, empieza a llover y deciden cambiar el plan.",
        "ru": "Однако начинается дождь, и они решают изменить план.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Podemos ir al museo —propone Marta.",
        "ru": "—Можем пойти в музей, —предлагает Марта.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "—Buena idea, pero primero quiero desayunar —dice Leo.",
        "ru": "—Хорошая идея, но сначала я хочу позавтракать, —говорит Лео.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Buscan una cafetería cerca del museo y comparten una tortilla.",
        "ru": "Они ищут кафе рядом с музеем и делят одну тортилью.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Leo piensa que un plan nuevo también puede ser un buen plan.",
        "ru": "Лео думает, что новый план тоже может быть хорошим.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Что они собираются сделать перед музеем?",
      "options": [
        "Сходить на пляж",
        "Позавтракать",
        "Вернуться на вокзал"
      ],
      "answer": 1,
      "feedback": "Лео говорит «primero quiero desayunar»: сначала позавтракать, затем музей."
    },
    "mission": "Предложи новый план из-за дождя. Добавь, что хочешь сделать сначала.",
    "glossary": [
      {
        "es": "al día siguiente",
        "ru": "на следующий день"
      },
      {
        "es": "visitar",
        "ru": "посетить"
      },
      {
        "es": "playa",
        "ru": "пляж"
      },
      {
        "es": "sin embargo",
        "ru": "однако"
      },
      {
        "es": "empieza a llover",
        "ru": "начинается дождь"
      },
      {
        "es": "deciden",
        "ru": "решают"
      },
      {
        "es": "cambiar el plan",
        "ru": "изменить план"
      },
      {
        "es": "podemos",
        "ru": "мы можем"
      },
      {
        "es": "ir al museo",
        "ru": "пойти в музей"
      },
      {
        "es": "propone",
        "ru": "предлагает"
      },
      {
        "es": "buena idea",
        "ru": "хорошая идея"
      },
      {
        "es": "primero",
        "ru": "сначала"
      },
      {
        "es": "desayunar",
        "ru": "завтракать"
      },
      {
        "es": "buscan",
        "ru": "ищут"
      },
      {
        "es": "cafetería",
        "ru": "кафе"
      },
      {
        "es": "comparten",
        "ru": "делят / совместно едят"
      },
      {
        "es": "tortilla",
        "ru": "тортилья: омлет с картофелем в этой истории"
      },
      {
        "es": "piensa",
        "ru": "думает"
      },
      {
        "es": "también",
        "ru": "тоже"
      },
      {
        "es": "puede ser",
        "ru": "может быть"
      }
    ],
    "nextChapter": null
  },
  {
    "id": "article:ask-again",
    "kind": "article",
    "title": "Если не понял ответ",
    "level": "A1",
    "theme": "Язык и помощь",
    "minutes": 7,
    "format": "Статья",
    "formatId": "article",
    "es": "No necesitas entender cada palabra para hablar. Si no entiendes una respuesta, puedes pedir ayuda. «¿Puedes repetir, por favor?» es una pregunta útil. También puedes decir: «Más despacio, por favor». Después, repite la información importante: «¿A las cinco?». Así compruebas que entiendes la hora.",
    "ru": "Чтобы говорить, не обязательно понимать каждое слово. Если ты не понимаешь ответ, можно попросить помощи. «Можешь повторить, пожалуйста?» — полезный вопрос. Можно также сказать: «Помедленнее, пожалуйста».  Затем повтори важную информацию: «В пять?».  Так ты проверяешь, что понимаешь время.",
    "lines": [
      {
        "es": "No necesitas entender cada palabra para hablar.",
        "ru": "Чтобы говорить, не обязательно понимать каждое слово.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Si no entiendes una respuesta, puedes pedir ayuda.",
        "ru": "Если ты не понимаешь ответ, можно попросить помощи.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "«¿Puedes repetir, por favor?» es una pregunta útil.",
        "ru": "«Можешь повторить, пожалуйста?» — полезный вопрос.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "También puedes decir: «Más despacio, por favor».",
        "ru": "Можно также сказать: «Помедленнее, пожалуйста».",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Después, repite la información importante: «¿A las cinco?».",
        "ru": "Затем повтори важную информацию: «В пять?».",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Así compruebas que entiendes la hora.",
        "ru": "Так ты проверяешь, что понимаешь время.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Зачем повторить «¿A las cinco?»?",
      "options": [
        "Чтобы проверить, правильно ли понял время",
        "Чтобы отказаться от помощи",
        "Чтобы заказать пять кофе"
      ],
      "answer": 0,
      "feedback": "Повтор ключевой информации помогает проверить понимание: «В пять?»"
    },
    "mission": "Попроси повторить ответ медленнее, затем уточни услышанное время.",
    "glossary": [
      {
        "es": "necesitas",
        "ru": "тебе нужно"
      },
      {
        "es": "entender",
        "ru": "понимать"
      },
      {
        "es": "cada palabra",
        "ru": "каждое слово"
      },
      {
        "es": "para hablar",
        "ru": "чтобы говорить"
      },
      {
        "es": "si",
        "ru": "если"
      },
      {
        "es": "entiendes",
        "ru": "ты понимаешь"
      },
      {
        "es": "respuesta",
        "ru": "ответ"
      },
      {
        "es": "puedes pedir ayuda",
        "ru": "можешь попросить помощи"
      },
      {
        "es": "puedes repetir",
        "ru": "можешь повторить"
      },
      {
        "es": "pregunta útil",
        "ru": "полезный вопрос"
      },
      {
        "es": "también",
        "ru": "также"
      },
      {
        "es": "decir",
        "ru": "сказать"
      },
      {
        "es": "más despacio",
        "ru": "помедленнее"
      },
      {
        "es": "después",
        "ru": "затем / после"
      },
      {
        "es": "repite",
        "ru": "повтори"
      },
      {
        "es": "información importante",
        "ru": "важная информация"
      },
      {
        "es": "a las cinco",
        "ru": "в пять"
      },
      {
        "es": "así",
        "ru": "так / таким образом"
      },
      {
        "es": "compruebas",
        "ru": "проверяешь"
      },
      {
        "es": "hora",
        "ru": "время / час"
      }
    ],
    "nextChapter": null
  },
  {
    "id": "article:small-practice",
    "kind": "article",
    "title": "Маленькая практика каждый день",
    "level": "A2",
    "theme": "Язык и помощь",
    "minutes": 7,
    "format": "Статья",
    "formatId": "article",
    "es": "Una conversación corta puede tener un objetivo claro. Por ejemplo, puedes pedir algo en un café sin leer una frase preparada. Primero escucha un ejemplo y fíjate en las palabras importantes. Luego intenta decirlo con tus propios datos: otra bebida, otra cantidad o un horario diferente. Si te cuesta, mira el ejemplo, ciérralo y vuelve a intentarlo. Al día siguiente, comprueba qué recuerdas sin mirar.",
    "ru": "У короткого разговора может быть понятная цель. Например, можно попросить что-то в кафе, не читая заранее подготовленную фразу. Сначала послушай пример и обрати внимание на важные слова. Затем попробуй сказать это со своими данными: другой напиток, другое количество или другое время. Если это трудно, посмотри на пример, закрой его и попробуй снова. На следующий день проверь, что ты помнишь без подсказки.",
    "lines": [
      {
        "es": "Una conversación corta puede tener un objetivo claro.",
        "ru": "У короткого разговора может быть понятная цель.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Por ejemplo, puedes pedir algo en un café sin leer una frase preparada.",
        "ru": "Например, можно попросить что-то в кафе, не читая заранее подготовленную фразу.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Primero escucha un ejemplo y fíjate en las palabras importantes.",
        "ru": "Сначала послушай пример и обрати внимание на важные слова.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Luego intenta decirlo con tus propios datos: otra bebida, otra cantidad o un horario diferente.",
        "ru": "Затем попробуй сказать это со своими данными: другой напиток, другое количество или другое время.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Si te cuesta, mira el ejemplo, ciérralo y vuelve a intentarlo.",
        "ru": "Если это трудно, посмотри на пример, закрой его и попробуй снова.",
        "audio": null,
        "speaker": null
      },
      {
        "es": "Al día siguiente, comprueba qué recuerdas sin mirar.",
        "ru": "На следующий день проверь, что ты помнишь без подсказки.",
        "audio": null,
        "speaker": null
      }
    ],
    "task": {
      "prompt": "Какая попытка показывает, что ты вспомнил фразу самостоятельно?",
      "options": [
        "Читать готовую фразу",
        "Повторить без просмотра примера",
        "Только слушать образец"
      ],
      "answer": 1,
      "feedback": "В тексте говорится «qué recuerdas sin mirar»: что ты помнишь без просмотра. Слушание помогает подготовиться, но не заменяет самостоятельную попытку."
    },
    "mission": "Выбери знакомую просьбу, измени одну деталь и скажи её без текста.",
    "glossary": [
      {
        "es": "conversación corta",
        "ru": "короткий разговор"
      },
      {
        "es": "puede tener",
        "ru": "может иметь"
      },
      {
        "es": "objetivo claro",
        "ru": "понятная цель"
      },
      {
        "es": "por ejemplo",
        "ru": "например"
      },
      {
        "es": "pedir algo",
        "ru": "попросить / заказать что-то"
      },
      {
        "es": "sin leer",
        "ru": "не читая"
      },
      {
        "es": "frase preparada",
        "ru": "подготовленная фраза"
      },
      {
        "es": "primero",
        "ru": "сначала"
      },
      {
        "es": "escucha",
        "ru": "послушай"
      },
      {
        "es": "ejemplo",
        "ru": "пример"
      },
      {
        "es": "fíjate en",
        "ru": "обрати внимание на"
      },
      {
        "es": "palabras importantes",
        "ru": "важные слова"
      },
      {
        "es": "luego",
        "ru": "затем"
      },
      {
        "es": "intenta decirlo",
        "ru": "попробуй сказать это"
      },
      {
        "es": "tus propios datos",
        "ru": "твои собственные данные"
      },
      {
        "es": "bebida",
        "ru": "напиток"
      },
      {
        "es": "cantidad",
        "ru": "количество"
      },
      {
        "es": "horario diferente",
        "ru": "другое время / расписание"
      },
      {
        "es": "si te cuesta",
        "ru": "если тебе трудно"
      },
      {
        "es": "ciérralo",
        "ru": "закрой его"
      },
      {
        "es": "vuelve a intentarlo",
        "ru": "попробуй ещё раз"
      },
      {
        "es": "al día siguiente",
        "ru": "на следующий день"
      },
      {
        "es": "comprueba",
        "ru": "проверь"
      },
      {
        "es": "recuerdas",
        "ru": "ты помнишь"
      },
      {
        "es": "sin mirar",
        "ru": "не глядя"
      }
    ],
    "nextChapter": null
  }
];
 for(const b of collectionTexts){b.glossary.push({es:'por favor',ru:'пожалуйста'});if(['serial:leo:2','article:small-practice'].includes(b.id))b.glossary.push({es:'café',ru:'кафе (заведение)'});}
 const books=[...course,...native,...authored,...collectionTexts].map(b=>({...b,formatId:b.formatId||(b.kind==='course'?'dialogue':b.kind==='native'?(b.format==='Диалог'?'dialogue':'mini'):(['b2-library','c1-memory'].includes(b.sourceId)?'article':'story')),format:b.format||(b.kind==='native'?'Мини-текст':'История')})),byId=new Map(books.map(b=>[b.id,b]));
 const formats=[['all','Все форматы'],['dialogue','Диалоги'],['mini','Мини-тексты'],['story','Истории'],['article','Статьи']];
 const fullyRecorded=b=>b.lines.length>0&&b.lines.every(l=>l.audio);
 const seriesNames=[...new Set(collectionTexts.filter(b=>b.series).map(b=>b.series))];
 const categories=[...new Set(books.map(b=>b.theme))];
 const levels=[['all','Все уровни'],['starter','С нуля'],['A1','A1'],['A2','A2'],['B1','B1'],['B2','B2 — образец'],['C1','C1 — образец']];
 const authoredWordMeanings={
  "abandonada": "заброшенная",
  "abrir": "открывать",
  "acceso": "доступ",
  "ahora": "теперь",
  "al": "a + el: к / в",
  "algunos": "некоторые",
  "amigos": "друзья",
  "antes": "раньше",
  "antiguos": "прежние",
  "aprender": "учить / осваивать",
  "así": "так / таким образом",
  "atender": "обслуживать",
  "aunque": "хотя",
  "ayuda": "помощь",
  "barrio": "район города",
  "bastaba": "было достаточно",
  "biblioteca": "библиотека",
  "busca": "ищет",
  "cada": "каждый / каждая",
  "cambié": "я сменил / сменила",
  "cocinar": "готовить еду",
  "comida": "еда",
  "como": "как; tanto… como… — «как… так и…»",
  "condiciones": "условия",
  "conservar": "сохранять",
  "considerar": "учитывать",
  "contar": "рассказать",
  "contarlos": "рассказать их (истории)",
  "convertir": "превратить",
  "convertirse": "превратиться / обернуться",
  "cuando": "когда",
  "cuesta": "стоит (о цене)",
  "cultural": "культурный",
  "debate": "обсуждение / дискуссия",
  "decidir": "решать",
  "del": "de + el: из / от / принадлежность",
  "delante": "перед; delante de — «перед»",
  "derecho": "право",
  "desayunaba": "завтракал / завтракала (обычно раньше)",
  "después": "после / затем",
  "diario": "ежедневный",
  "diez": "десять",
  "dio": "дал / дала; dio sentido — «придал смысл»",
  "disponibilidad": "доступность",
  "distinta": "другая / иного рода",
  "durante": "в течение",
  "edificio": "здание",
  "el": "определённый артикль мужского рода",
  "elijo": "я выбираю",
  "ellos": "они",
  "embargo": "в sin embargo: «однако»",
  "empezó": "начал / начала; empezó a — «стал…»",
  "empleados": "сотрудники",
  "encuentra": "находит",
  "encuentro": "я нахожу",
  "es": "это / является (форма ser)",
  "estaban": "были; estaban preparando — «готовили в тот момент»",
  "está": "находится",
  "euros": "евро",
  "evidente": "очевидный / очевидная",
  "explicar": "объяснить",
  "facilitar": "облегчить",
  "falta": "в hacían falta: «требовались»",
  "final": "конец; al final — «в итоге»",
  "forma": "способ / форма",
  "fue": "была; fue bien recibida — «была хорошо принята»",
  "funciona": "работает / действует",
  "fábrica": "фабрика",
  "ha": "вспомогательная форма: me ha ofrecido — «предложила мне»",
  "hacía": "было; hacía frío — «было холодно»",
  "hacían": "в hacían falta: «требовались»",
  "he": "вспомогательная форма: he vuelto — «я вернулся / вернулась»",
  "hice": "я сделал / сделала",
  "horas": "часы",
  "idioma": "язык",
  "implica": "предполагает / требует",
  "invitaron": "пригласили",
  "la": "определённый артикль женского рода",
  "le": "ей (Марте в этой истории)",
  "levantaba": "в se levantaba: «вставал» (обычно раньше)",
  "llama": "звонит",
  "llaves": "ключи",
  "los": "определённый артикль мужского рода, множественное число",
  "mejor": "лучше / лучшее",
  "mejorar": "улучшить",
  "menos": "меньше",
  "mis": "мои",
  "mostró": "показало",
  "mudé": "в me mudé: «я переехал / переехала»",
  "muy": "очень",
  "máquina": "машина / механизм",
  "más": "больше",
  "necesito": "мне нужно / я нуждаюсь",
  "nos": "нас",
  "nuevos": "новые",
  "o": "или",
  "ocho": "восемь",
  "ofrecido": "в ha ofrecido: «предложила»",
  "otra": "другая",
  "paga": "платит",
  "pago": "я плачу",
  "palabras": "слова",
  "para": "для / чтобы",
  "parece": "кажется",
  "parque": "парк",
  "pasamos": "мы провели",
  "pasear": "гулять",
  "pedir": "попросить",
  "pensaba": "я думал / думала (раньше)",
  "pequeña": "маленькая",
  "pie": "стопа; a pie — «пешком»",
  "piso": "квартира (в Испании)",
  "plan": "план",
  "poco": "немного",
  "por": "по / в / за — зависит от сочетания",
  "prepara": "готовит",
  "preparando": "готовя; estaban preparando — «готовили в тот момент»",
  "producto": "товар / продукт",
  "puede": "может",
  "pérdida": "потеря / утрата",
  "que": "что / который — по контексту",
  "queda": "в le queda: «ей подходит по размеру / сидит на ней»",
  "quienes": "те, кто",
  "quiere": "хочет",
  "recibida": "принята",
  "recuperación": "восстановление",
  "recuperar": "восстановить",
  "reembolso": "возврат денег",
  "sale": "выходит / отправляется",
  "se": "часть конструкции; смотри значение в предложении",
  "seguirán": "продолжат; seguirán siendo — «останутся»",
  "sentido": "смысл",
  "servicio": "услуга / служба",
  "señalaron": "указали / отметили",
  "siendo": "будучи; seguirán siendo — «останутся»",
  "siete": "семь",
  "sin": "без",
  "sino": "а; no… sino… — «не… а…»",
  "situación": "ситуация",
  "sola": "одна / единственная",
  "sábado": "суббота",
  "tanto": "в tanto… como…: «как… так и…»",
  "tendrá": "будет иметь; tendrá derecho — «будет вправе»",
  "tienda": "магазин",
  "tiene": "имеет / у него или неё есть",
  "todavía": "всё ещё",
  "trabaja": "работает",
  "trabajan": "работают",
  "transformación": "преобразование",
  "transporte": "транспорт",
  "trata": "в se trata de: «речь идёт о»",
  "una": "неопределённый артикль женского рода",
  "unos": "несколько / неопределённый артикль множественного числа",
  "usuarios": "пользователи / посетители",
  "va": "идёт",
  "vecinos": "соседи",
  "veinte": "двадцать",
  "visibles": "видимые",
  "vive": "живёт",
  "vuelto": "в he vuelto: «я вернулся / вернулась»",
  "y": "и / а",
  "ya": "уже",
  "íbamos": "мы собирались; íbamos a — план в прошлом"
};
 const contextMeanings={
  "reading:a1-shop:1:21": "в le queda pequeña: «ей мала»",
  "reading:b1-move:1:18": "более; más pequeño — «поменьше»",
  "reading:a2-routine:3:31": "утро; por la mañana — «утром»",
  "reading:a2-weekend:1:7": "утро; por la mañana — «утром»",
  "text:9:0:17": "завтра",
  "reading:b1-move:0:17": "работа (существительное); cambiar de trabajo — «сменить работу»",
  "text:8:2:7": "я работаю (форма trabajar)",
  "reading:a2-return:1:14": "в: направление, здесь — в магазин",
  "reading:b1-move:1:8": "в: направление, здесь — в квартиру",
  "story:25:2:15": "часть por favor: «пожалуйста»",
  "reading:a1-home:3:10": "a перед человеком, которому звонят; отдельно не переводится",
  "reading:a1-trip:1:21": "в ocho y diez: «восемь десять»",
  "reading:a1-trip:3:27": "в así que: «поэтому»",
  "reading:a2-routine:0:13": "в se levantaba: «вставал»",
  "reading:a2-routine:0:26": "поздно",
  "reading:a2-routine:2:34": "завтрак (существительное)",
  "reading:a2-routine:3:7": "в tiene que: «ему приходится / он должен»",
  "reading:a2-routine:3:13": "часть tiene que + глагол: «должен / приходится»",
  "reading:a2-routine:3:24": "в por la mañana: «утром»",
  "reading:a2-weekend:0:17": "часть íbamos a + глагол: «мы собирались…»",
  "reading:a2-weekend:0:26": "по (гулять по парку)",
  "reading:a2-weekend:1:0": "в por la mañana: «утром»",
  "reading:a2-weekend:2:18": "a перед людьми, которых навещают; отдельно не переводится",
  "reading:b1-move:0:49": "часть empezó a + глагол: «стал…»",
  "reading:b1-move:3:0": "в lo mejor: «лучше всего»",
  "reading:b1-move:4:22": "a перед людьми, по которым скучают; отдельно не переводится",
  "reading:b1-study:2:78": "в lo que: «то, что»",
  "reading:c1-memory:1:0": "в sin embargo: «однако»",
  "reading:c1-memory:2:3": "в se trata de: «речь идёт о»",
  "story:20:1:4": "часть ir a + глагол: «собираться сделать что-то»",
  "story:20:3:4": "часть ir a + глагол: «собираться сделать что-то»",
  "story:21:1:4": "часть ir a + глагол: «собираться сделать что-то»",
  "story:23:0:9": "часть ir a + глагол: «собираться сделать что-то»",
  "story:28:0:9": "часть ir a + глагол: «собираться сделать что-то»",
  "text:9:0:9": "часть ir a + глагол: «собираться сделать что-то»",
  "text:9:1:4": "часть ir a + глагол: «собираться сделать что-то»",
  "text:9:3:4": "часть ir a + глагол: «собираться сделать что-то»",
  "serial:ana:1:1:11": "a перед человеком, с которым знакомятся; отдельно не переводится",
  "serial:leo:1:0:10": "к / на: направление, здесь — на вокзал",
  "serial:leo:1:2:9": "к / у: обратиться к женщине с вопросом",
  "reading:a2-weekend:3:51": "связка invitar a + глагол: «пригласить сделать что-то»",
  "reading:b2-library:0:93": "допоздна (hasta tarde)",
  "reading:c1-memory:2:115": "часть tener derecho a + глагол: «иметь право сделать что-то»",
  "reading:a1-home:2:0": "её — Аны (su vecina: «её соседка»)",
  "reading:a1-home:3:39": "часть delante de: «перед»",
  "reading:a1-trip:3:34": "часть a pie: «пешком»",
  "reading:a2-routine:1:44": "от (далеко от дома)",
  "reading:b1-move:0:14": "часть cambiar de trabajo: «сменить работу»",
  "reading:b1-move:1:36": "часть cerca de: «рядом с»",
  "reading:b1-move:2:5": "часть un poco más: «немного больше»",
  "reading:b1-study:1:8": "часть después de: «после»",
  "reading:b2-library:0:68": "к / для: доступ для тех, кто работает допоздна",
  "reading:b2-library:1:143": "перед людьми, которых обслуживают; отдельно не переводится",
  "reading:b2-library:2:105": "принадлежность: условия тех людей, кто обеспечивает услугу",
  "reading:b2-library:2:116": "её — услугу (исп. servicio мужского рода)",
  "reading:c1-memory:0:81": "связка forma de + глагол: «способ сделать что-то»",
  "reading:c1-memory:1:60": "труд / работа (существительное)",
  "reading:c1-memory:2:12": "связка в se trata de / sino de: «речь о / а о»",
  "reading:c1-memory:2:44": "связка в se trata de / sino de: «речь о / а о»"
};
 const tokenCache=new Map();
 function tokens(book,lineIndex){
  const key=book.id+':'+lineIndex;if(tokenCache.has(key))return tokenCache.get(key);
  const text=book.lines[lineIndex].es,parts=[];let at=0;
  const phrases=(book.glossary||[]).filter(g=>g.es.includes(' ')).map(g=>({...g,span:g.es.replace(/^[¿¡]+|[?!.,;:]+$/g,'')})).sort((a,b)=>b.span.length-a.span.length);
  const rx=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;let m;
  while((m=rx.exec(text))){
   if(m.index<at)continue;
   if(m.index>at)parts.push({text:text.slice(at,m.index)});
   const rest=text.slice(m.index),phrase=phrases.find(g=>norm(rest.slice(0,g.span.length))===norm(g.span)&&!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(rest[g.span.length]||''));
   const label=phrase?rest.slice(0,phrase.span.length):m[0];
   const own=phrase||(book.glossary||[]).find(g=>norm(g.es)===norm(label));
   const known=dictionary.get(norm(label)),key=book.id+':'+lineIndex+':'+m.index,ru=contextMeanings[key]||(book.kind==='authored'?authoredWordMeanings[norm(label)]:null)||own?.ru||properNames[label]||known?.ru||(['native','course','serial','article'].includes(book.kind)?additions[norm(label)]:null);
   const exactWord=data.wordAudio?.words?.[label.normalize('NFC').toLocaleLowerCase('es')];
   const exact=Object.values(data.expanded.audio).find(a=>norm(a.text)===norm(label));
   parts.push({text:label,word:true,ru:ru||null,libraryId:known?.id||null,audio:exactWord||exact?.audioId||null,key:book.id+':'+lineIndex+':'+m.index,line:lineIndex,offset:m.index});at=m.index+label.length;rx.lastIndex=at;
  }
  if(at<text.length)parts.push({text:text.slice(at)});tokenCache.set(key,parts);return parts;
 }
 const tokenMap=new Map();for(const b of books)for(let i=0;i<b.lines.length;i++)for(const t of tokens(b,i))if(t.word)tokenMap.set(t.key,{...t,bookId:b.id});
 const empty=()=>({translations:[],selectedGloss:null,rangeStart:0,rangeEnd:null,answer:null,checked:false,aided:false,attempts:[],visited:false});
 const safeTime=n=>Number.isFinite(n)&&n>0&&n<=Date.now()+60000;
 function sanitize(raw){
  const s={selected:null,type:'all',format:'all',recorded:false,level:'all',theme:'all',search:'',page:0,collection:false,saved:[],rows:{}};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
  s.selected=byId.has(raw.selected)?raw.selected:null;s.format=formats.some(x=>x[0]===raw.format)?raw.format:'all';s.recorded=raw.recorded===true;s.type=['all','course','native','authored','serial','article'].includes(raw.type)?raw.type:'all';s.level=levels.some(x=>x[0]===raw.level)?raw.level:'all';s.theme=categories.includes(raw.theme)?raw.theme:'all';s.search=typeof raw.search==='string'?raw.search.slice(0,80):'';s.collection=raw.collection===true;
  s.page=Number.isInteger(raw.page)&&raw.page>=0?Math.min(raw.page,Math.max(0,Math.ceil(filteredFor(s).length/8)-1)):0;
  s.saved=[...new Set(Array.isArray(raw.saved)?raw.saved.filter(k=>tokenMap.has(k)&&tokenMap.get(k).ru):[])];
  if(raw.rows&&typeof raw.rows==='object')for(const b of books){
   const r=raw.rows[b.id];if(!r||typeof r!=='object'||Array.isArray(r))continue;
   const v=empty();v.translations=[...new Set(Array.isArray(r.translations)?r.translations.filter(i=>Number.isInteger(i)&&i>=0&&i<b.lines.length):[])];v.selectedGloss=tokenMap.get(r.selectedGloss)?.bookId===b.id?r.selectedGloss:null;v.visited=r.visited===true;v.aided=r.aided===true||v.translations.length>0||v.selectedGloss!==null;
   v.rangeStart=Number.isInteger(r.rangeStart)?Math.max(0,Math.min(b.lines.length-1,r.rangeStart)):0;v.rangeEnd=Number.isInteger(r.rangeEnd)?Math.max(v.rangeStart,Math.min(b.lines.length-1,r.rangeEnd)):b.lines.length-1;
   v.answer=Number.isInteger(r.answer)&&b.task&&r.answer>=0&&r.answer<b.task.options.length?r.answer:null;v.checked=r.checked===true&&v.answer!==null;
   for(const a of Array.isArray(r.attempts)?r.attempts.slice(0,1).concat(r.attempts.slice(1).slice(-9)):[]){if(b.task&&a&&Number.isInteger(a.value)&&a.value>=0&&a.value<b.task.options.length&&safeTime(a.time))v.attempts.push({value:a.value,correct:a.value===b.task.answer,aided:a.aided===true,time:a.time});}
   // A checked result must correspond to an actual recorded check, not imported markup.
   if(!v.attempts.length||v.attempts.at(-1).value!==v.answer)v.checked=false;
   s.rows[b.id]=v;
  }
  return s;
 }
 state.reader=sanitize(state.reader);
 const prefs=()=>state.reader;
 const current=()=>byId.get(prefs().selected);
 const row=b=>prefs().rows[b.id]??=(empty());
 const levelLabel=b=>b.level==='starter'?'С нуля':b.level;
 const formatLabel=b=>formats.find(x=>x[0]===b.formatId)?.[1]?.replace('Диалоги','Диалог').replace('Мини-тексты','Мини-текст').replace('Истории','История').replace('Статьи','Статья')||'Текст';
 const voiceLabel=b=>fullyRecorded(b)?'Полная озвучка':b.lines.some(l=>l.audio)?'Частичная озвучка':'Без записи текста';
 const successful=b=>row(b).attempts.some(a=>a.correct);
 function filteredFor(s){return books.filter(b=>(s.type==='all'||b.kind===s.type)&&(s.level==='all'||b.level===s.level)&&(s.theme==='all'||b.theme===s.theme)&&(s.format==='all'||b.formatId===s.format)&&(!s.recorded||fullyRecorded(b))&&(!s.search||norm([b.title,b.lines.map(l=>l.es).join(' '),b.ru,b.theme].join(' ')).includes(norm(s.search))));}
 function filtered(){return filteredFor(prefs());}
 function options(list,value){return list.map(([k,v])=>`<option value="${esc(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('');}
 function catalogRow(b){return `<article class="reader-book"><button type="button" data-reader-open="${esc(b.id)}"><div><h2>${esc(b.title)}</h2><p class="reader-book-meta">${b.kind==='course'?'День '+b.day+' · ':''}${esc(levelLabel(b))} · ${esc(formatLabel(b))} · ${b.minutes} мин · ${esc(voiceLabel(b))}${successful(b)?' · смысл проверен':''}</p>${b.series?`<p class="reader-book-series">${esc(b.series)} · Глава ${b.chapter} / ${b.chapters}</p>`:''}<p class="reader-preview" lang="es">${esc(b.lines[0].es)}</p></div>${icon('arrow-up-right')}</button></article>`;}
 function catalog(){
  const list=filtered(),s=prefs(),pages=Math.max(1,Math.ceil(list.length/8)),page=Math.min(s.page,pages-1),shown=list.slice(page*8,page*8+8),fresh=!Object.values(s.rows).some(r=>r.visited),first=course.find(b=>b.day===state.day)||course[0]||native[0];
  return `<section class="page reader-catalog"><div class="reader-heading"><h1>Чтение</h1><p>Истории, статьи и диалоги. Выбери уровень и читай с переводом.</p></div><div class="reader-guide">${mascot?.('wave')||''}<p>${fresh?'Начни с простого знакомства. Послушай, прочитай, затем проверь смысл.':'Прочитай → проверь смысл → перескажи своими словами.'}</p></div>${fresh&&s.type==='all'&&s.level==='all'&&s.theme==='all'&&s.format==='all'&&!s.recorded&&!s.search&&first?`<button type="button" class="btn primary reader-first" data-reader-open="${esc(first.id)}">Начать с «${esc(first.title)}» ${icon('arrow-right')}</button>`:''}<div class="reader-filters"><label>Уровень<select class="select" id="reader-level">${options(levels,s.level)}</select></label><label>Формат<select class="select" id="reader-format">${options(formats,s.format)}</select></label><details class="reader-extra-filters"><summary>Тема и подборка ${icon('chevron-down')}</summary><div><label>Подборка<select class="select" id="reader-type">${options([['all','Все тексты'],['course','По дням курса'],['native','С полной озвучкой'],['authored','Короткие чтения по уровням'],['serial','Истории по главам'],['article','Новые статьи']],s.type)}</select></label><label>Тема<select class="select" id="reader-theme">${options([['all','Все темы'],...categories.map(t=>[t,t])],s.theme)}</select></label></div></details><label class="reader-search">Найти текст<input id="reader-search" class="field" type="search" maxlength="80" value="${esc(s.search)}" placeholder="Название, тема или фраза…"></label></div><div class="reader-quick-filters"><button type="button" class="btn quiet" data-reader-recorded aria-pressed="${s.recorded}">${icon('headphones')}Полная озвучка</button><button type="button" class="btn quiet" data-reader-series aria-pressed="${s.type==='serial'}">${icon('book-open')}Истории по главам</button></div><div class="reader-result-row"><p role="status">${list.length} ${list.length%10===1&&list.length%100!==11?'текст':[2,3,4].includes(list.length%10)&&![12,13,14].includes(list.length%100)?'текста':'текстов'}</p><button type="button" class="btn quiet" data-reader-collection>${icon('bookmark')}Мои слова · ${s.saved.length}</button></div>${['course','native','authored','serial','article'].map(kind=>{const group=shown.filter(b=>b.kind===kind);return group.length?`<section class="reader-shelf"><h2>${kind==='course'?'По дням курса':kind==='native'?'Слушай и читай':kind==='serial'?'Истории по главам':kind==='article'?'Статьи':'Короткие чтения по уровням'}</h2><p class="reader-source-note">${kind==='course'?'30 связанных сцен: прочитай, пойми и ответь. Озвучены только отмеченные реплики.':kind==='native'?'12 коротких текстов: оригинальные записи каждой строки.':kind==='serial'?'Две истории по три главы. Перевод, вопрос по смыслу и свой пересказ.':kind==='article'?'Короткие статьи для практики чтения. Записи целого текста пока нет.':'Авторские тексты без полной озвучки. Уровни — редакционная оценка сложности.'}</p><div class="reader-book-list">${group.map(catalogRow).join('')}</div></section>`:''}).join('')}${pages>1?`<nav class="reader-pages-nav" aria-label="Страницы библиотеки чтения"><button type="button" class="btn quiet" data-reader-page="-1" ${page===0?'disabled':''}>${icon('arrow-left')}Назад</button><span>${page+1} / ${pages}</span><button type="button" class="btn quiet" data-reader-page="1" ${page>=pages-1?'disabled':''}>Дальше${icon('arrow-right')}</button></nav>`:''}${!list.length?'<div class="reader-empty"><h2>Текстов по этим фильтрам нет</h2><button type="button" class="btn" data-reader-reset>Показать все тексты</button></div>':''}${footer()}</section>`;
 }
 function glossary(b,t){
  const line=b.lines[t.line],s=prefs(),saved=s.saved.includes(t.key),clip=t.audio||line.audio;
  return `<aside class="reader-gloss" aria-live="polite" aria-label="Значение выбранного слова"><div class="reader-gloss-heading"><h2 lang="es">${esc(t.text)}</h2><button type="button" class="btn quiet icon" data-reader-gloss-close aria-label="Закрыть значение">${icon('x')}</button></div><p>${t.ru?esc(t.ru):'Отдельный перевод этого слова пока не добавлен. Смотри смысл предложения ниже.'}</p>${clip?`<div class="reader-gloss-audio"><p>${t.audio?'В записи:':'В записи целиком:'} <span lang="es">${esc(t.audio?t.text:line.es)}</span></p>${playButton(clip,t.audio?'Слушать '+(t.text.includes(' ')?'сочетание: ':'слово: ')+t.text:'Слушать всё предложение: '+line.es,true)}</div>`:'<p class="reader-source-note">У этого предложения пока нет записи носителя.</p>'}${clip?audioStatus():''}<div class="reader-context-meaning"><span>Смысл предложения</span><p>${esc(line.ru)}</p></div>${clip?`<details class="reader-word-source"><summary>Запись и лицензия</summary><div>${audioCredit({audio:clip})}</div></details>`:''}${t.ru?`<button type="button" class="btn quiet" data-reader-save="${esc(t.key)}" aria-pressed="${saved}">${icon(saved?'check':'bookmark')}${saved?'В моих словах':t.text.includes(' ')?'Сохранить сочетание':'Сохранить слово'}</button>`:''}</aside>`;
 }
 function sentence(b,p,i){
  const r=row(b),selected=tokenMap.get(r.selectedGloss),show=r.translations.includes(i);
  return `<div class="reader-line" data-reader-line="${i}" ${p.audio?`data-line-audio="${esc(p.audio)}"`:''}><div class="reader-line-top">${b.format==='Диалог'?`<span class="reader-speaker">${esc(p.speaker||'Собеседник')}</span>`:''}${p.audio?playButton(p.audio,'Слушать предложение '+(i+1)+': '+p.es):''}</div><p class="reader-spanish" lang="es">${tokens(b,i).map(t=>t.word?`<button type="button" class="reader-word ${r.selectedGloss===t.key?'selected':''}" data-reader-word="${esc(t.key)}" aria-expanded="${r.selectedGloss===t.key}" aria-label="Значение: ${esc(t.text)}">${esc(t.text)}</button>`:esc(t.text)).join('')}</p>${selected?.line===i?glossary(b,selected):''}<button type="button" class="reader-translate" data-reader-translation="${i}" aria-expanded="${show}">${icon('languages')}${show?'Скрыть перевод':'Перевод предложения'}</button>${show?`<p class="reader-translation">${esc(p.ru)}</p>`:''}</div>`;
 }
 function rangeControls(b,r){
  const end=r.rangeEnd===null?b.lines.length-1:r.rangeEnd,selection=b.lines.slice(r.rangeStart,end+1),count=selection.filter(l=>l.audio).length;
  return `<details class="reader-excerpt"><summary>${icon('headphones')}Слушать отрывок ${icon('chevron-down')}</summary><div class="reader-excerpt-body"><div class="reader-range-fields"><label>Начало отрывка<select id="reader-range-start">${b.lines.map((l,i)=>`<option value="${i}" ${r.rangeStart===i?'selected':''}>${i+1}. ${esc(l.es)}</option>`).join('')}</select></label><label>Конец отрывка<select id="reader-range-end">${b.lines.map((l,i)=>`<option value="${i}" ${end===i?'selected':''} ${i<r.rangeStart?'disabled':''}>${i+1}. ${esc(l.es)}</option>`).join('')}</select></label></div><button type="button" class="btn" data-reader-excerpt ${!count?'disabled':''}>${icon('headphones')}Слушать выбранное · ${count}</button><p class="reader-source-note">${count===selection.length?'Все выбранные строки озвучены.':count+' из '+selection.length+' выбранных строк имеют запись. Неозвученные строки будут пропущены.'} Каждая запись звучит целиком.</p></div></details>`;
 }
 function reading(b){
  const recordings=b.lines.filter(p=>p.audio),complete=recordings.length===b.lines.length;
  const r=row(b),correct=r.checked&&r.answer===b.task?.answer;
  return `<section class="reading reader-detail" data-reader-book="${esc(b.id)}"><button type="button" class="btn quiet reader-back" data-reader-back>${icon('arrow-left')}К текстам</button><div class="reader-heading"><h1 tabindex="-1">${esc(b.title)}</h1><p>${b.kind==='course'?'День '+b.day+' · ':''}${esc(levelLabel(b))} · ${esc(formatLabel(b))} · ${b.minutes} мин${b.series?' · '+esc(b.series)+' · Глава '+b.chapter+' / '+b.chapters:''}</p></div><div class="reader-guide">${mascot?.(correct?'joy':'think')||''}<p>${b.kind==='course'?esc(b.goal)+' ':''}Нажми на слово для перевода. Для целой строки — «Перевод предложения».</p></div>${recordings.length?`<div class="reader-player"><button type="button" class="btn primary" data-reader-play>${icon('headphones')}${complete?'Слушать текст':'Слушать озвученные реплики · '+recordings.length}</button><label>Темп<select data-audio-speed aria-label="Скорость озвучки">${[.5,.75,.85,1,1.25].map(n=>`<option value="${n}" ${state.audioSpeed===n?'selected':''}>×${String(n).replace('.',',')}</option>`).join('')}</select></label></div><p class="reader-source-note">${complete?'Отдельные оригинальные записи строк с короткими паузами.':'Озвучено '+recordings.length+' из '+b.lines.length+' реплик. Остальные строки — только текст.'}</p>${rangeControls(b,r)}`:`<p class="reader-source-note">${b.kind==='course'?'Озвучено 0 из '+b.lines.length+' реплик. Сцена пока доступна только для чтения.':'Авторский текст · записи носителя пока нет.'}</p>`}<article class="reader-pages" aria-label="Текст на испанском">${b.lines.map((p,i)=>sentence(b,p,i)).join('')}</article>${tokenMap.get(r.selectedGloss)&&(tokenMap.get(r.selectedGloss).audio||b.lines[tokenMap.get(r.selectedGloss).line]?.audio)?'':audioStatus()}${b.task?`<section class="reader-check"><h2>Проверь смысл</h2><p>${esc(b.task.prompt)}</p><div class="reader-answers">${b.task.options.map((o,i)=>`<button type="button" class="option" data-reader-answer="${i}" aria-pressed="${r.answer===i}">${esc(o)}</button>`).join('')}</div><button type="button" class="btn primary" data-reader-check ${r.answer===null?'disabled':''}>Проверить</button>${r.checked?`<div class="feedback ${correct?'':'wrong'}" role="status"><div class="reader-result-guide">${mascot?.(correct?'joy':'think')||''}<h3>${correct?'Ты понял смысл':'Прочитай ещё раз'}</h3></div><p>${esc(b.task.feedback)}</p>${r.attempts.at(-1)?.aided?'<p class="reader-source-note">Ты использовал перевод или словарь. Следующая попытка может быть без опоры.</p>':''}</div>`:''}</section>`:''}${correct?`<section class="reader-retell"><h2>Теперь своими словами</h2><p>${esc(b.mission)}</p><button type="button" class="btn" data-reader-repeat>${icon('repeat-2')}Прочитать без переводов</button>${b.kind==='native'&&api.startScene?`<button type="button" class="btn primary" data-reader-scene="${esc(b.id)}">${icon('messages-square')}Практиковать разговор</button>`:''}${b.kind==='course'&&api.openWorkbook?`<button type="button" class="btn primary" data-reader-workbook="${b.day}">${icon('messages-square')}Ещё вопросы и свой ответ</button>`:''}${b.kind==='authored'&&b.sourceId&&api.openReading?`<button type="button" class="btn" data-reader-legacy="${esc(b.sourceId)}">${icon('brain')}Вспомнить фразу без текста</button>`:''}${b.nextChapter?`<button type="button" class="btn primary" data-reader-open="${esc(b.nextChapter)}">Следующая глава ${icon('arrow-right')}</button>`:''}</section>`:''}${recordings.length?`<details class="reader-sources"><summary>Записи и лицензии</summary><div>${recordings.map(p=>`<p lang="es">${esc(p.es)}</p>${audioCredit(p)}`).join('')}${audioControls()}</div></details>`:''}${['B2','C1'].includes(b.level)?'<p class="reader-source-note">Это один образец чтения. Он не является программой курса или подтверждением уровня.</p>':''}${footer()}</section>`;
 }
 function savedWords(){return prefs().saved.map(k=>{const t=tokenMap.get(k),b=byId.get(t.bookId),line=b.lines[t.line];return {key:k,bookId:b.id,es:t.text,ru:t.ru,context:line.es,contextRu:line.ru,audio:t.audio||line.audio,exactAudio:!!t.audio,libraryId:t.libraryId};});}
 function collection(){return `<section class="page reader-collection"><button type="button" class="btn quiet" data-reader-back>${icon('arrow-left')}К текстам</button><h1>Мои слова из чтения</h1><p>Значение вместе с контекстом — легче вспомнить, когда это сказать.</p>${savedWords().map(w=>`<article class="reader-saved-word"><h2 lang="es">${esc(w.es)}</h2><p>${esc(w.ru)}</p><div class="reader-saved-context"><p lang="es">${esc(w.exactAudio?w.es:w.context)}</p>${w.audio?playButton(w.audio,w.exactAudio?'Слушать: '+w.es:'Слушать предложение: '+w.context):'<span class="reader-source-note">Без записи</span>'}</div><p class="reader-source-note">${w.exactAudio?'Запись выбранного выражения':'Контекст: '+w.contextRu}</p><div class="reader-saved-actions"><button type="button" class="btn quiet" data-reader-open="${esc(w.bookId)}">Вернуться к тексту ${icon('arrow-right')}</button><button type="button" class="btn quiet icon" data-reader-save="${esc(w.key)}" aria-label="Убрать из моих слов: ${esc(w.es)}">${icon('bookmark-minus')}</button></div></article>`).join('')}${!prefs().saved.length?'<div class="reader-empty"><h2>Здесь появятся слова, которые ты сохранишь</h2><p>Открой текст, нажми на знакомое или новое слово и выбери «Сохранить».</p><button type="button" class="btn primary" data-reader-back>Выбрать текст</button></div>':''}${audioStatus()}${footer()}</section>`;}
 function html(){const b=current();return prefs().collection?collection():b?reading(b):catalog();}
 function refresh(focus){const y=window.scrollY,previousHeight=document.querySelector('.reader-detail')?.getBoundingClientRect?.().height,open=[...document.querySelectorAll?.('.reader-detail details[open]')||[]].map(el=>el.className);save();render();if(current()&&Number.isFinite(previousHeight)&&previousHeight>0){const detail=document.querySelector('.reader-detail');if(detail?.style)detail.style.minHeight=Math.ceil(previousHeight)+'px';}for(const name of open){const selector='.'+name.split(/\s+/).filter(Boolean).join('.');document.querySelector(selector)?.setAttribute?.('open','');}window.scrollTo({top:y,behavior:'instant'});if(focus)document.querySelector(focus)?.focus({preventScroll:true});}
 function revealGloss(){const box=document.querySelector('.reader-gloss')?.getBoundingClientRect?.();if(!box)return;const header=document.querySelector('.topbar')?.getBoundingClientRect?.().bottom||0,nav=document.querySelector('.mobile-nav')?.getBoundingClientRect?.().top||window.innerHeight,bottom=Math.min(window.innerHeight||nav,nav)-16,needed=Math.min(box.height,170);if(box.top<header+12)window.scrollTo({top:Math.max(0,window.scrollY+box.top-header-12),behavior:'instant'});else if(box.top+needed>bottom)window.scrollTo({top:Math.max(0,window.scrollY+box.top+needed-bottom),behavior:'instant'});}
 let catalogY=0;
 function enter(id){if(id&&byId.has(id)){prefs().selected=id;prefs().collection=false;}if(current())row(current()).visited=true;save();}
 function click(b){
  const s=prefs();
  if(b.hasAttribute('data-reader-open')){const id=b.dataset.readerOpen;if(!byId.has(id))return true;if(!current())catalogY=window.scrollY;s.selected=id;s.collection=false;row(byId.get(id)).visited=true;save();render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('.reader-detail h1')?.focus({preventScroll:true});return true;}
  if(b.hasAttribute('data-reader-back')){s.selected=null;s.collection=false;save();render();window.scrollTo({top:catalogY,behavior:'instant'});document.querySelector('.reader-heading h1')?.focus({preventScroll:true});return true;}
  if(b.hasAttribute('data-reader-collection')){catalogY=window.scrollY;s.collection=true;save();render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('.reader-collection h1')?.focus({preventScroll:true});return true;}
  if(b.hasAttribute('data-reader-page')){const direction=Number(b.dataset.readerPage);if(direction!==-1&&direction!==1)return true;const pages=Math.max(1,Math.ceil(filtered().length/8));s.page=Math.min(pages-1,Math.max(0,s.page+direction));save();render();const result=document.querySelector('.reader-result-row');if(result){result.tabIndex=-1;result.focus({preventScroll:true});const top=result.getBoundingClientRect?.().top;if(Number.isFinite(top)){const header=document.querySelector('.topbar')?.getBoundingClientRect?.().bottom||0;window.scrollTo({top:Math.max(0,window.scrollY+top-header-16),behavior:'instant'});}}return true;}
  if(b.hasAttribute('data-reader-reset')){s.type=s.level=s.theme=s.format='all';s.recorded=false;s.search='';s.page=0;refresh();return true;}
  if(b.hasAttribute('data-reader-recorded')){s.recorded=!s.recorded;s.page=0;refresh('[data-reader-recorded]');return true;}
  if(b.hasAttribute('data-reader-series')){s.type=s.type==='serial'?'all':'serial';s.format=s.level=s.theme='all';s.recorded=false;s.search='';s.page=0;refresh('[data-reader-series]');return true;}
  if(b.hasAttribute('data-reader-save')){const key=b.dataset.readerSave,t=tokenMap.get(key);if(!t?.ru)return true;const at=s.saved.indexOf(key);if(at<0){s.saved.push(key);if(t.libraryId&&state.library?.favorites&&!state.library.favorites.includes(t.libraryId))state.library.favorites.push(t.libraryId);toast?.('Сохранено вместе с контекстом.');}else s.saved.splice(at,1);refresh(`[data-reader-save="${CSS.escape(key)}"]`);return true;}
  if(b.hasAttribute('data-reader-scene')){api.startScene?.(b.dataset.readerScene);return true;}
  if(b.hasAttribute('data-reader-workbook')){const day=Number(b.dataset.readerWorkbook);if(course.some(x=>x.day===day))api.openWorkbook?.(day);return true;}
  if(b.hasAttribute('data-reader-legacy')){api.openReading?.(b.dataset.readerLegacy);return true;}
  const book=current();if(!book)return false;const r=row(book);
  if(b.hasAttribute('data-reader-word')){const key=b.dataset.readerWord,t=tokenMap.get(key);if(!t||t.bookId!==book.id)return true;r.selectedGloss=r.selectedGloss===key?null:key;if(r.selectedGloss)r.aided=true;refresh(`[data-reader-word="${CSS.escape(key)}"]`);if(r.selectedGloss)revealGloss();if(r.selectedGloss&&t.audio){const fresh=document.querySelector(`[data-reader-word="${CSS.escape(key)}"]`);playSequence?.([t.audio],fresh);}return true;}
  if(b.hasAttribute('data-reader-gloss-close')){const key=r.selectedGloss;r.selectedGloss=null;refresh(key?`[data-reader-word="${CSS.escape(key)}"]`:null);return true;}
  if(b.hasAttribute('data-reader-translation')){const i=Number(b.dataset.readerTranslation);if(!Number.isInteger(i)||i<0||i>=book.lines.length)return true;const at=r.translations.indexOf(i);if(at<0){r.translations.push(i);r.aided=true;}else r.translations.splice(at,1);refresh(`[data-reader-translation="${i}"]`);return true;}
  if(b.hasAttribute('data-reader-excerpt')){const end=r.rangeEnd===null?book.lines.length-1:r.rangeEnd,ids=book.lines.slice(r.rangeStart,end+1).filter(l=>l.audio).map(l=>l.audio);if(ids.length)playSequence?.(ids,b);return true;}
  if(b.hasAttribute('data-reader-play')){if(book.lines.some(p=>p.audio))playSequence?.(book.lines.filter(p=>p.audio).map(p=>p.audio),b);return true;}
  if(b.hasAttribute('data-reader-answer')){const i=Number(b.dataset.readerAnswer);if(book.task&&Number.isInteger(i)&&i>=0&&i<book.task.options.length&&r.answer!==i){r.answer=i;r.checked=false;refresh(`[data-reader-answer="${i}"]`);}return true;}
  if(b.hasAttribute('data-reader-check')){if(!book.task||r.answer===null)return true;r.checked=true;const attempt={value:r.answer,correct:r.answer===book.task.answer,aided:r.aided,time:Date.now()};r.attempts.push(attempt);if(r.attempts.length>10)r.attempts=[r.attempts[0],...r.attempts.slice(-9)];refresh('[data-reader-check]');return true;}
  if(b.hasAttribute('data-reader-repeat')){r.translations=[];r.selectedGloss=null;r.answer=null;r.checked=false;r.aided=false;save();render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('.reader-detail h1')?.focus({preventScroll:true});return true;}
  return false;
 }
 function change(el){const s=prefs();if(el.id==='reader-format'){s.format=formats.some(x=>x[0]===el.value)?el.value:'all';s.page=0;refresh('#reader-format');return true;}if(el.id==='reader-range-start'||el.id==='reader-range-end'){const book=current(),i=Number(el.value);if(!book||!Number.isInteger(i)||i<0||i>=book.lines.length)return true;const r=row(book);if(el.id==='reader-range-start'){r.rangeStart=i;r.rangeEnd=Math.max(i,r.rangeEnd??book.lines.length-1);}else r.rangeEnd=Math.max(r.rangeStart,i);refresh('#'+el.id);return true;}if(el.id==='reader-level'){s.level=levels.some(x=>x[0]===el.value)?el.value:'all';s.page=0;refresh('#reader-level');return true;}if(el.id==='reader-type'){s.type=['all','course','native','authored','serial','article'].includes(el.value)?el.value:'all';s.page=0;refresh('#reader-type');return true;}if(el.id==='reader-theme'){s.theme=categories.includes(el.value)?el.value:'all';s.page=0;refresh('#reader-theme');return true;}if(el.id==='reader-search'){s.search=el.value.slice(0,80);s.page=0;refresh('#reader-search');return true;}return false;}
 return {html,render:html,click,handleClick:click,change,handleChange:change,enter,sanitize,savedWords,audioContextKey:()=>JSON.stringify(['reader',prefs().collection,prefs().selected,current()?row(current()).rangeStart:null,current()?row(current()).rangeEnd:null]),context:()=>({reader:true,day:current()?.day||state.day,extensionLesson:current()?{mission:current().mission,pattern:'',explanation:'Сначала прочитай и пойми смысл. Перевод и словарь отмечаются как опора. Затем перескажи без текста.',examples:current().lines.filter(p=>p.audio)}:null}),catalog:()=>books};
}};
