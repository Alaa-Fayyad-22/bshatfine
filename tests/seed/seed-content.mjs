// Sample content for the Bshatfine staging site.
// Realistic but invented: no real names, fees or phone numbers. Replace before launch.
// Times are Beirut time with the correct offset (+03:00 until 25 Oct 2026, +02:00 after).

const tr = (ar, en) => [{ language: "ar", ...ar }, { language: "en", ...en }];
const MAP = "https://www.google.com/maps/search/?api=1&query=Bshatfine+Chouf+Lebanon";

export const CONTENT = {
  // ------------------------------------------------------------------ NEWS (5)
  news: [
    { cover: true, body: { translations: tr(
      { title: "الانتهاء من تزفيت الطريق الداخلي للبلدة",
        body: "أنهت البلدية أعمال تزفيت الطريق الداخلي الممتد من الساحة العامة حتى الحي الشرقي، بطول يقارب كيلومتراً واحداً.\n\nوشملت الأعمال تأهيل جوانب الطريق وتحسين تصريف مياه الأمطار، بما يخفف من تجمّع المياه خلال فصل الشتاء.\n\nوتشكر البلدية الأهالي على تعاونهم وصبرهم خلال فترة الأشغال." },
      { title: "Paving of the village's internal road completed",
        body: "The municipality has finished paving the internal road from the main square to the eastern quarter, a length of about one kilometre.\n\nThe works also repaired the road edges and improved rainwater drainage, reducing standing water in winter.\n\nThe municipality thanks residents for their cooperation and patience during the works." }) } },
    { cover: true, body: { translations: tr(
      { title: "حملة تنظيف خريفية بمشاركة المتطوعين",
        body: "نظّمت البلدية حملة تنظيف شاملة للطرقات والأحراج المحيطة بالبلدة، بمشاركة عشرات المتطوعين من شباب وشابات البلدة.\n\nوتمّ خلال الحملة جمع النفايات من جوانب الطرق وتنظيف مجاري المياه استعداداً لموسم الأمطار.\n\nتدعو البلدية الجميع إلى الحفاظ على نظافة البلدة طوال العام." },
      { title: "Autumn cleaning campaign with volunteers",
        body: "The municipality organised a wide cleaning campaign along the roads and the woods around the village, with dozens of young volunteers taking part.\n\nWaste was collected from the roadsides and water channels were cleared ahead of the rainy season.\n\nThe municipality invites everyone to keep the village clean all year round." }) } },
    { cover: true, body: { translations: tr(
      { title: "تركيب إنارة تعمل بالطاقة الشمسية في الساحة العامة",
        body: "باشرت البلدية تركيب أعمدة إنارة تعمل بالطاقة الشمسية في الساحة العامة والطرقات المؤدية إليها.\n\nيهدف المشروع إلى تحسين السلامة ليلاً وتخفيف كلفة الكهرباء على البلدية، في ظل الانقطاع المتكرر للتيار." },
      { title: "Solar street lights installed in the main square",
        body: "The municipality has started installing solar-powered street lights in the main square and the roads leading to it.\n\nThe project improves safety at night and lowers the municipality's electricity costs, given the frequent power cuts." }) } },
    { cover: true, body: { translations: tr(
      { title: "تذكير ببرنامج فرز النفايات من المصدر",
        body: "تذكّر البلدية الأهالي ببرنامج فرز النفايات من المصدر: المواد القابلة لإعادة التدوير (البلاستيك والكرتون والمعادن) في المستوعبات الزرقاء، وباقي النفايات في المستوعبات الخضراء.\n\nيساهم الفرز في تخفيف الكميات المرسلة إلى المطامر وفي الحفاظ على بيئة البلدة." },
      { title: "Reminder: sorting waste at home",
        body: "The municipality reminds residents of the waste sorting programme: recyclables (plastic, cardboard and metal) go in the blue containers, and all other waste in the green ones.\n\nSorting reduces the amount sent to landfill and helps protect the village's environment." }) } },
    { cover: true, body: { translations: tr(
      { title: "زراعة ٢٠٠ شجرة على مدخل البلدة",
        body: "زرعت البلدية بالتعاون مع المدرسة الرسمية وعدد من المتطوعين ٢٠٠ شجرة من الصنوبر والسنديان على جانبي مدخل البلدة.\n\nوستتولى البلدية ريّ الأشجار ومتابعتها خلال السنوات الأولى حتى تثبت جذورها." },
      { title: "200 trees planted along the village entrance",
        body: "Together with the public school and volunteers, the municipality planted 200 pine and oak trees on both sides of the village entrance.\n\nThe municipality will water and care for the trees during their first years until they are well rooted." }) } },
  ],

  // ------------------------------------------------------------------ ENTRIES (15)
  entries: [
    // history (3) - no category
    { cover: true, alternatives: [{ year: 1900 }], body: { kind: "history", year: 1880, translations: tr(
      { title: "البيوت القديمة والعمارة الحجرية",
        summary: "بيوت من الحجر الصخري والقناطر والقرميد الأحمر تروي حكاية البلدة.",
        body: "تتميّز البلدة ببيوتها القديمة المبنية من الحجر الصخري، بسقوفها المرتفعة وقناطرها ونوافذها المقوّسة.\n\nبُنيت معظم هذه البيوت على يد معلّمي العمار من أبناء المنطقة، وما زال عدد منها مسكوناً حتى اليوم بعد ترميمه بعناية." },
      { title: "Old houses and stone architecture",
        summary: "Stone houses, arches and red tiled roofs that tell the village's story.",
        body: "The village is known for its old houses built of local stone, with high ceilings, arches and arched windows.\n\nMost were built by local master builders, and several are still lived in today after careful restoration." }) } },
    { cover: true, alternatives: [{ year: 1950 }], body: { kind: "history", year: 1920, translations: tr(
      { title: "نبع البلدة ودوره في الحياة اليومية",
        summary: "كان النبع ملتقى الأهالي ومصدر الماء الأول للبيوت والبساتين.",
        body: "قبل وصول شبكة المياه إلى البيوت، كان النبع المصدر الأساسي للماء، تقصده النساء صباحاً بالجرار وتُروى منه البساتين.\n\nوكان النبع أيضاً مكاناً للقاء وتبادل الأخبار، ولا يزال حتى اليوم من أحبّ الأماكن إلى قلوب الأهالي." },
      { title: "The village spring and daily life",
        summary: "The spring was a meeting place and the main source of water for homes and orchards.",
        body: "Before piped water reached the houses, the spring was the main source of water: women came in the morning with clay jars and the orchards were watered from it.\n\nIt was also a place to meet and share news, and it remains one of the residents' favourite places." }) } },
    { cover: true, alternatives: [{ year: 1960 }], body: { kind: "history", year: 1950, translations: tr(
      { title: "الزيتون والزراعة على المصاطب",
        summary: "حوّل الأجداد السفوح إلى مصاطب زُرعت بالزيتون والكرمة.",
        body: "بنى الأجداد جدراناً حجرية على سفوح التلال لتحويلها إلى مصاطب صالحة للزراعة، وزرعوها بالزيتون والكرمة والأشجار المثمرة.\n\nولا يزال موسم قطاف الزيتون في الخريف مناسبة تجمع العائلات، ويُعصر الزيت في معاصر المنطقة." },
      { title: "Olives and terraced farming",
        summary: "Earlier generations turned the slopes into terraces planted with olives and vines.",
        body: "Earlier generations built dry stone walls on the hillsides to create terraces for farming, planted with olives, vines and fruit trees.\n\nThe autumn olive harvest still brings families together, and the oil is pressed in the presses of the area." }) } },

    // projects (4)
    { cover: true, alternatives: [{ status: "ongoing" }], body: { kind: "project", category: "water", status: "completed", year: 2025, translations: tr(
      { title: "إعادة تأهيل شبكة مياه الشفة",
        summary: "استبدال الأنابيب القديمة في الأحياء الرئيسية للحدّ من الهدر والأعطال.",
        body: "شمل المشروع استبدال الأنابيب القديمة في الأحياء الرئيسية وتركيب عدادات جديدة، ما خفّف الأعطال والهدر بشكل ملحوظ.\n\nويجري العمل على المرحلة الثانية التي تشمل الأحياء الطرفية." },
      { title: "Drinking water network rehabilitation",
        summary: "Old pipes replaced in the main neighbourhoods to reduce leaks and breakdowns.",
        body: "The project replaced old pipes in the main neighbourhoods and installed new meters, clearly reducing breakdowns and water loss.\n\nWork is under way on the second phase, covering the outer neighbourhoods." }) } },
    { cover: true, alternatives: [{ category: "electricity" }, { category: "lighting" }, { category: "infrastructure" }, { category: "roads" }],
      body: { kind: "project", category: "energy", status: "ongoing", year: 2026, translations: tr(
      { title: "إنارة الطرقات بالطاقة الشمسية",
        summary: "تركيب أعمدة إنارة شمسية على الطرق الرئيسية والساحة العامة.",
        body: "يهدف المشروع إلى إنارة الطرقات الرئيسية بأعمدة تعمل بالطاقة الشمسية، بما يضمن الإنارة ليلاً حتى خلال انقطاع الكهرباء.\n\nأُنجزت المرحلة الأولى في الساحة العامة، وتليها الطرق المؤدية إلى الأحياء." },
      { title: "Solar street lighting",
        summary: "Solar street lights on the main roads and in the main square.",
        body: "The project lights the main roads with solar-powered poles, so the streets stay lit at night even during power cuts.\n\nThe first phase in the main square is complete; the roads to the neighbourhoods come next." }) } },
    { cover: true, alternatives: [{ category: "parks" }, { category: "public-spaces" }, { category: "environment" }, { category: "other" }, { category: "roads" }],
      body: { kind: "project", category: "environment", status: "planned", year: 2027, translations: tr(
      { title: "تأهيل الحديقة العامة وملعب الأطفال",
        summary: "مساحة خضراء آمنة للعائلات مع ألعاب للأطفال ومقاعد وإنارة.",
        body: "يتضمّن المشروع تأهيل الحديقة العامة وتجهيزها بألعاب آمنة للأطفال ومقاعد وممرات للمشي وإنارة.\n\nيُتوقّع بدء الأعمال في ربيع العام المقبل بعد استكمال الدراسات." },
      { title: "Public garden and playground renovation",
        summary: "A safe green space for families, with play equipment, benches and lighting.",
        body: "The project will renovate the public garden with safe play equipment, benches, walking paths and lighting.\n\nWork is expected to start next spring once the studies are complete." }) } },
    { cover: true, alternatives: [{ category: "roads" }, { status: "ongoing" }],
      body: { kind: "project", category: "water", status: "completed", year: 2026, translations: tr(
      { title: "قناة لتصريف مياه الأمطار على الطريق الرئيسي",
        summary: "قناة جديدة تحمي الطريق والمنازل من السيول في فصل الشتاء.",
        body: "أنشأت البلدية قناة لتصريف مياه الأمطار على طول الطريق الرئيسي، بعد أن كانت السيول تتسبّب كل شتاء بأضرار للطريق والمنازل المجاورة.\n\nوتتابع البلدية تنظيف القناة بشكل دوري قبل موسم الأمطار." },
      { title: "Rainwater drainage channel on the main road",
        summary: "A new channel that protects the road and homes from winter floods.",
        body: "The municipality built a rainwater drainage channel along the main road, where floods used to damage the road and nearby homes every winter.\n\nThe channel is cleaned regularly before the rainy season." }) } },

    // places (4)
    { cover: true, alternatives: [{ category: "nature" }], body: { kind: "place", category: "heritage", translations: tr(
      { title: "الساحة العامة",
        summary: "قلب البلدة وملتقى أهلها في المناسبات والأمسيات.",
        body: "تقع الساحة العامة في وسط البلدة، تحيط بها البيوت القديمة والمحال الصغيرة.\n\nتُقام فيها المناسبات والاحتفالات، وهي المكان المفضّل للقاء الأهالي في أمسيات الصيف." },
      { title: "The main square",
        summary: "The heart of the village, where people gather for events and summer evenings.",
        body: "The main square sits in the centre of the village, surrounded by old houses and small shops.\n\nEvents and celebrations are held here, and it is the favourite meeting place on summer evenings." }) } },
    { cover: true, alternatives: [{ category: "heritage" }], body: { kind: "place", category: "nature", translations: tr(
      { title: "نبع البلدة",
        summary: "مياه باردة وظلال الأشجار، محطة لا بدّ منها لزوار البلدة.",
        body: "يقع النبع عند طرف البلدة بين الأشجار، وتنساب مياهه الباردة على مدار السنة.\n\nيمكن الوصول إليه سيراً على الأقدام من الساحة العامة في نحو عشر دقائق." },
      { title: "The village spring",
        summary: "Cool water and shady trees, a must-see for visitors.",
        body: "The spring lies at the edge of the village among the trees, and its cool water flows all year round.\n\nIt is about a ten-minute walk from the main square." }) } },
    { cover: true, alternatives: [{ category: "heritage" }], body: { kind: "place", category: "nature", translations: tr(
      { title: "المطلّ البانورامي على الوادي",
        summary: "إطلالة واسعة على وادي الشوف، والأجمل عند الغروب.",
        body: "من المطلّ البانورامي يمكن رؤية الوادي والقرى المجاورة، وفي الأيام الصافية يظهر البحر في الأفق.\n\nيُنصح بزيارته عند الغروب، مع الحرص على النظافة وعدم ترك النفايات." },
      { title: "Panoramic viewpoint over the valley",
        summary: "A wide view over the Chouf valley, best at sunset.",
        body: "From the viewpoint you can see the valley and the neighbouring villages, and on clear days the sea on the horizon.\n\nBest visited at sunset; please keep the place clean." }) } },
    { cover: true, alternatives: [{ category: "nature" }], body: { kind: "place", category: "heritage", translations: tr(
      { title: "الحي القديم",
        summary: "أزقّة ضيّقة وبيوت حجرية تحافظ على طابع البلدة الأصيل.",
        body: "يضمّ الحي القديم أزقّة ضيّقة ودرجاً حجرياً وبيوتاً تعود إلى أكثر من قرن.\n\nالتجوّل فيه سيراً على الأقدام يعطي صورة عن حياة البلدة في الماضي." },
      { title: "The old quarter",
        summary: "Narrow lanes and stone houses that keep the village's original character.",
        body: "The old quarter has narrow lanes, stone stairways and houses more than a century old.\n\nA walk through it gives a picture of village life in the past." }) } },

    // services (4) - the category is tried without, then with common values
    ...[
      [{ title: "طلب رخصة بناء", summary: "الخطوات والمستندات المطلوبة للحصول على رخصة بناء أو ترميم.",
         body: "يُقدَّم الطلب في مكتب البلدية مرفقاً بسند الملكية أو إفادة عقارية، والخرائط الهندسية الموقّعة من مهندس، وصورة عن الهوية.\n\nتدرس البلدية الطلب وتحيله إلى الجهات المختصة عند الحاجة، ويُبلَّغ صاحب العلاقة بالنتيجة." },
       { title: "Building permit application", summary: "Steps and documents needed for a building or renovation permit.",
         body: "Apply at the municipal office with the title deed or a land registry statement, engineering drawings signed by an engineer, and a copy of your ID.\n\nThe municipality reviews the application, refers it to the relevant authorities when needed, and informs you of the outcome." }, ["permit"]],
      [{ title: "إفادة سكن", summary: "إفادة تثبت مكان السكن ضمن نطاق البلدية.",
         body: "تُطلب الإفادة من مكتب البلدية بحضور صاحب العلاقة، مع صورة عن الهوية أو إخراج القيد.\n\nتُسلَّم الإفادة عادة خلال يوم عمل واحد." },
       { title: "Residence certificate", summary: "A certificate confirming your place of residence in the municipality.",
         body: "Request it at the municipal office in person, with a copy of your ID or civil registry record.\n\nIt is usually ready within one working day." }, ["certificate"]],
      [{ title: "طلب مستوعب نفايات", summary: "طلب وضع مستوعب جديد أو استبدال مستوعب متضرّر في الحي.",
         body: "يمكن تقديم الطلب في مكتب البلدية أو عبر الاتصال بها، مع تحديد الموقع المطلوب بدقّة.\n\nتدرس البلدية الطلب بحسب الحاجة والإمكانات المتاحة." },
       { title: "Waste container request", summary: "Ask for a new container, or the replacement of a damaged one, in your neighbourhood.",
         body: "Apply at the municipal office or by contacting the municipality, giving the exact location.\n\nThe municipality reviews requests according to need and available resources." }, ["waste", "environment", "other"]],
      [{ title: "دفع الرسوم البلدية", summary: "كيفية الاستعلام عن الرسوم البلدية المترتّبة وتسديدها.",
         body: "يمكن الاستعلام عن الرسوم البلدية وتسديدها في مكتب البلدية خلال الدوام الرسمي، مع إبراز رقم العقار أو الإيصال السابق.\n\nيُعطى المكلّف إيصالاً رسمياً بكل دفعة." },
       { title: "Paying municipal fees", summary: "How to check and pay the municipal fees you owe.",
         body: "You can check and pay municipal fees at the municipal office during working hours; bring the property number or a previous receipt.\n\nAn official receipt is given for every payment." }, ["fees", "payments", "other"]],
    ].map(([ar, en, cats]) => ({
      cover: true,
      alternatives: [...cats.map((c) => ({ category: c })), { kind: "services", category: undefined }],
      body: { kind: "service", translations: tr(ar, en) },
    })),
  ],

  // ------------------------------------------------------------------ EVENTS (5)
  events: [
    { cover: true, body: { category: "cultural", isAllDay: true, startsAt: "2026-12-05T00:00:00+02:00", mapUrl: MAP, translations: tr(
      { title: "يوم قطاف الزيتون", summary: "يوم عائلي لقطاف الزيتون في بساتين البلدة.", location: "بساتين الزيتون - الحي الغربي", organizer: "بلدية بشتفين",
        body: "تدعو البلدية العائلات والشباب للمشاركة في يوم قطاف الزيتون، مع فطور قروي وأنشطة للأطفال." },
      { title: "Olive harvest day", summary: "A family day picking olives in the village groves.", location: "Olive groves, western quarter", organizer: "Bshatfine Municipality",
        body: "The municipality invites families and young people to join the olive harvest, with a village breakfast and activities for children." }) } },
    { cover: true, body: { category: "cultural", isAllDay: false, startsAt: "2026-12-27T18:00:00+02:00", endsAt: "2026-12-27T22:00:00+02:00", mapUrl: MAP, translations: tr(
      { title: "أمسية نهاية العام", summary: "أمسية للأهالي في الساحة العامة مع موسيقى وضيافة.", location: "الساحة العامة", organizer: "بلدية بشتفين",
        body: "تحتفل البلدة بنهاية العام بأمسية في الساحة العامة تتضمّن موسيقى وفقرات للأطفال وضيافة." },
      { title: "Year-end community evening", summary: "An evening for residents in the main square with music and refreshments.", location: "Main square", organizer: "Bshatfine Municipality",
        body: "The village celebrates the end of the year with an evening in the main square: music, activities for children and refreshments." }) } },
    { cover: true, body: { category: "health", isAllDay: false, startsAt: "2027-01-10T09:00:00+02:00", endsAt: "2027-01-10T14:00:00+02:00", mapUrl: MAP, translations: tr(
      { title: "يوم صحي مجاني مع عيادة نقّالة", summary: "فحوص مجانية لضغط الدم والسكري واستشارات طبية عامة.", location: "قاعة البلدية", organizer: "البلدية بالتعاون مع جمعية صحية",
        body: "تستقبل عيادة نقّالة الأهالي لإجراء فحوص مجانية لضغط الدم والسكري واستشارات طبية عامة. يُرجى إحضار الأدوية المزمنة أو لائحة بها." },
      { title: "Free health day with a mobile clinic", summary: "Free blood pressure and diabetes checks and general medical advice.", location: "Municipal hall", organizer: "The municipality with a health association",
        body: "A mobile clinic will offer free blood pressure and diabetes checks and general medical advice. Please bring your regular medicines or a list of them." }) } },
    { cover: true, body: { category: "municipal-meeting", isAllDay: false, startsAt: "2027-01-15T17:00:00+02:00", endsAt: "2027-01-15T19:00:00+02:00", mapUrl: MAP, translations: tr(
      { title: "جلسة علنية للمجلس البلدي", summary: "عرض مشاريع العام الجديد والاستماع إلى ملاحظات الأهالي.", location: "قاعة البلدية", organizer: "المجلس البلدي",
        body: "يعقد المجلس البلدي جلسة علنية لعرض خطة مشاريع العام الجديد، يليها وقت مخصّص لأسئلة الأهالي وملاحظاتهم." },
      { title: "Public municipal council meeting", summary: "Presenting the new year's projects and hearing residents' feedback.", location: "Municipal hall", organizer: "Municipal council",
        body: "The municipal council holds a public meeting to present the new year's project plan, followed by time for residents' questions and feedback." }) } },
    { cover: true, body: { category: "sports", isAllDay: true, startsAt: "2026-11-08T00:00:00+02:00", mapUrl: MAP, translations: tr(
      { title: "يوم المشي الخريفي", summary: "مسار مشي بين الأحراج والمصاطب حتى المطلّ.", location: "الانطلاق من الساحة العامة", organizer: "بلدية بشتفين",
        body: "شارك الأهالي في مسار مشي خريفي انطلق من الساحة العامة مروراً بالأحراج والمصاطب وصولاً إلى المطلّ البانورامي." },
      { title: "Autumn hiking day", summary: "A walk through the woods and terraces up to the viewpoint.", location: "Start: main square", organizer: "Bshatfine Municipality",
        body: "Residents took part in an autumn walk from the main square through the woods and terraces up to the panoramic viewpoint." }) } },
  ],

  // ------------------------------------------------------------------ NOTICES (5)
  notices: [
    { body: { category: "water", priority: "urgent", validFrom: "2026-11-26T08:00:00+02:00", validUntil: "2026-12-08T18:00:00+02:00", translations: tr(
      { title: "انقطاع المياه للصيانة في حيّين", area: "الحي الشرقي وحي العين",
        body: "بسبب أعمال صيانة على الخط الرئيسي، ستنقطع المياه بشكل متقطّع في الحيّين المذكورين. يُرجى تعبئة الخزانات مسبقاً. نعتذر عن الإزعاج." },
      { title: "Water cut in two neighbourhoods for maintenance", area: "Eastern quarter and the spring quarter",
        body: "Because of maintenance on the main line, water will be cut on and off in these neighbourhoods. Please fill your tanks in advance. We apologise for the inconvenience." }) } },
    { body: { category: "waste", priority: "important", validFrom: "2026-11-24T00:00:00+02:00", validUntil: "2027-01-23T23:59:00+02:00", translations: tr(
      { title: "الجدول الجديد لجمع النفايات", area: "جميع الأحياء",
        body: "تُجمع النفايات أيام الإثنين والأربعاء والسبت صباحاً. يُرجى وضع الأكياس في المستوعبات مساءً فقط، وعدم تركها على جوانب الطرق." },
      { title: "New waste collection schedule", area: "All neighbourhoods",
        body: "Waste is collected on Monday, Wednesday and Saturday mornings. Please put bags in the containers only the evening before, never at the roadside." }) } },
    { body: { category: "fees", priority: "normal", validUntil: "2026-12-31T23:59:00+02:00", translations: tr(
      { title: "تذكير بمهلة تسديد الرسوم البلدية",
        body: "تذكّر البلدية المكلّفين بضرورة تسديد الرسوم البلدية عن العام الحالي قبل نهاية شهر كانون الأول، تجنّباً لأي غرامات." },
      { title: "Reminder: municipal fees deadline",
        body: "The municipality reminds residents to pay this year's municipal fees before the end of December to avoid any penalties." }) } },
    { body: { category: "roads", priority: "normal", validFrom: "2026-11-30T07:00:00+02:00", validUntil: "2026-12-04T17:00:00+02:00", translations: tr(
      { title: "تحويل مؤقت لحركة السير بسبب أشغال", area: "الطريق الرئيسي قرب المدرسة",
        body: "بسبب أشغال على الطريق الرئيسي، سيتم تحويل حركة السير مؤقتاً خلال ساعات النهار. يُرجى التقيّد بإرشادات العمّال والانتباه." },
      { title: "Temporary traffic diversion during road works", area: "Main road near the school",
        body: "Because of works on the main road, traffic will be diverted during the day. Please follow the workers' instructions and drive carefully." }) } },
    { body: { category: "council", priority: "normal", validFrom: "2026-09-24T09:00:00+03:00", validUntil: "2026-10-24T18:00:00+03:00", translations: tr(
      { title: "ملخّص قرارات المجلس البلدي لشهر أيلول",
        body: "أقرّ المجلس البلدي في جلسته الشهرية متابعة مشروع شبكة المياه، وتنظيم حملة التنظيف الخريفية، ودراسة تأهيل الحديقة العامة." },
      { title: "Summary of the September council decisions",
        body: "At its monthly meeting the council approved continuing the water network project, organising the autumn cleaning campaign, and studying the renovation of the public garden." }) } },
  ],
};
