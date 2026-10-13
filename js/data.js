window.KanaData = {
  ROWS: [
    { id: 'vowel', name: '母音', nameEn: 'Vowels', chars: ['あ','い','う','え','お'] },
    { id: 'k', name: 'か行', nameEn: 'K-row', chars: ['か','き','く','け','こ'] },
    { id: 's', name: 'さ行', nameEn: 'S-row', chars: ['さ','し','す','せ','そ'] },
    { id: 't', name: 'た行', nameEn: 'T-row', chars: ['た','ち','つ','て','と'] },
    { id: 'n', name: 'な行', nameEn: 'N-row', chars: ['な','に','ぬ','ね','の'] },
    { id: 'h', name: 'は行', nameEn: 'H-row', chars: ['は','ひ','ふ','へ','ほ'] },
    { id: 'm', name: 'ま行', nameEn: 'M-row', chars: ['ま','み','む','め','も'] },
    { id: 'y', name: 'や行', nameEn: 'Y-row', chars: ['や','ゆ','よ'] },
    { id: 'r', name: 'ら行', nameEn: 'R-row', chars: ['ら','り','る','れ','ろ'] },
    { id: 'w', name: 'わ行', nameEn: 'W-row', chars: ['わ','を','ん'] }
  ],
  HIRAGANA: [
    { char: 'あ', romaji: 'a', row: 'vowel', type: 'hiragana', strokeCount: 3, mnemonic: 'An Apple with a stem. Look at the round shape of an apple.', confusables: ['お', 'め'] },
    { char: 'い', romaji: 'i', row: 'vowel', type: 'hiragana', strokeCount: 2, mnemonic: 'Two Iguanacorns standing side by side. Or simply Hawaii.', confusables: ['り', 'に'] },
    { char: 'う', romaji: 'u', row: 'vowel', type: 'hiragana', strokeCount: 2, mnemonic: 'U is for the letter U on its side, being thrown by an Umpire.', confusables: ['つ', 'ら'] },
    { char: 'え', romaji: 'e', row: 'vowel', type: 'hiragana', strokeCount: 2, mnemonic: 'An Exotic bird with a feather on its head.', confusables: ['ん'] },
    { char: 'お', romaji: 'o', row: 'vowel', type: 'hiragana', strokeCount: 3, mnemonic: 'An Owl with two faces on the side of a tree.', confusables: ['あ', 'む'] },
    
    { char: 'か', romaji: 'ka', row: 'k', type: 'hiragana', strokeCount: 3, mnemonic: 'Someone doing a Karate kick and sweating from the effort.', confusables: ['が'] },
    { char: 'き', romaji: 'ki', row: 'k', type: 'hiragana', strokeCount: 4, mnemonic: 'A Key with two ridges used to open a door.', confusables: ['さ', 'ち'] },
    { char: 'く', romaji: 'ku', row: 'k', type: 'hiragana', strokeCount: 1, mnemonic: 'The beak of a Cuckoo bird.', confusables: ['へ'] },
    { char: 'け', romaji: 'ke', row: 'k', type: 'hiragana', strokeCount: 3, mnemonic: 'A Keg of beer, slightly slanted.', confusables: ['は', 'に'] },
    { char: 'こ', romaji: 'ko', row: 'k', type: 'hiragana', strokeCount: 2, mnemonic: 'Two Koi fish swimming in a pond, one on top and one on bottom.', confusables: ['に', 'い'] },

    { char: 'さ', romaji: 'sa', row: 's', type: 'hiragana', strokeCount: 3, mnemonic: 'A Samurai sword pointing downwards.', confusables: ['き', 'ち'] },
    { char: 'し', romaji: 'shi', row: 's', type: 'hiragana', strokeCount: 1, mnemonic: 'A Shepherd\'s crook used to herd sheep.', confusables: ['も', 'ん'] },
    { char: 'す', romaji: 'su', row: 's', type: 'hiragana', strokeCount: 2, mnemonic: 'A Swing circling around a pole.', confusables: ['む', 'よ'] },
    { char: 'せ', romaji: 'se', row: 's', type: 'hiragana', strokeCount: 3, mnemonic: 'Setting the table, or someone Saying something with a big mouth.', confusables: ['や'] },
    { char: 'そ', romaji: 'so', row: 's', type: 'hiragana', strokeCount: 1, mnemonic: 'A zigzag Sewing stitch.', confusables: ['ろ', 'る'] },

    { char: 'た', romaji: 'ta', row: 't', type: 'hiragana', strokeCount: 4, mnemonic: 'Looks like the letters T and A right next to each other.', confusables: ['な', 'に'] },
    { char: 'ち', romaji: 'chi', row: 't', type: 'hiragana', strokeCount: 2, mnemonic: 'A Cheerleader doing a high kick.', confusables: ['さ', 'ら'] },
    { char: 'つ', romaji: 'tsu', row: 't', type: 'hiragana', strokeCount: 1, mnemonic: 'A Tsunami wave crashing down.', confusables: ['う', 'っ'] },
    { char: 'て', romaji: 'te', row: 't', type: 'hiragana', strokeCount: 1, mnemonic: 'A dog\'s Tail curving downwards.', confusables: ['そ', 'と'] },
    { char: 'と', romaji: 'to', row: 't', type: 'hiragana', strokeCount: 2, mnemonic: 'A Thorn stuck in somebody\'s Toe.', confusables: ['て'] },

    { char: 'な', romaji: 'na', row: 'n', type: 'hiragana', strokeCount: 4, mnemonic: 'A Nun praying in front of a cross.', confusables: ['た', 'は'] },
    { char: 'に', romaji: 'ni', row: 'n', type: 'hiragana', strokeCount: 3, mnemonic: 'A Needle and some thread.', confusables: ['こ', 'い'] },
    { char: 'ぬ', romaji: 'nu', row: 'n', type: 'hiragana', strokeCount: 2, mnemonic: 'Noodles twisted up with chopsticks.', confusables: ['め', 'ね'] },
    { char: 'ね', romaji: 'ne', row: 'n', type: 'hiragana', strokeCount: 2, mnemonic: 'A cat (Neko) with a curly tail catching a fish.', confusables: ['れ', 'わ'] },
    { char: 'の', romaji: 'no', row: 'n', type: 'hiragana', strokeCount: 1, mnemonic: 'A No entry sign, a circle with a slash through it.', confusables: ['め'] },

    { char: 'は', romaji: 'ha', row: 'h', type: 'hiragana', strokeCount: 3, mnemonic: 'Looks like the letters H and A next to each other.', confusables: ['ほ', 'ま', 'け'] },
    { char: 'ひ', romaji: 'hi', row: 'h', type: 'hiragana', strokeCount: 1, mnemonic: 'He has a big smile, showing his teeth. "Hee hee!"', confusables: ['び', 'ぴ'] },
    { char: 'ふ', romaji: 'fu', row: 'h', type: 'hiragana', strokeCount: 4, mnemonic: 'Mount Fuji with a cloud passing over it.', confusables: ['ぶ', 'ぷ'] },
    { char: 'へ', romaji: 'he', row: 'h', type: 'hiragana', strokeCount: 1, mnemonic: 'Points up to Heaven.', confusables: ['く'] },
    { char: 'ほ', romaji: 'ho', row: 'h', type: 'hiragana', strokeCount: 4, mnemonic: 'A House with a roof and a line crossing it. It\'s a hot day.', confusables: ['は', 'ま'] },

    { char: 'ま', romaji: 'ma', row: 'm', type: 'hiragana', strokeCount: 3, mnemonic: 'A Mast on a sailboat with two sails.', confusables: ['ほ', 'は'] },
    { char: 'み', romaji: 'mi', row: 'm', type: 'hiragana', strokeCount: 2, mnemonic: 'Who is 21? Me!', confusables: ['む'] },
    { char: 'む', romaji: 'mu', row: 'm', type: 'hiragana', strokeCount: 3, mnemonic: 'A cow (Moo) with a tail and a spot.', confusables: ['す', 'お'] },
    { char: 'め', romaji: 'me', row: 'm', type: 'hiragana', strokeCount: 2, mnemonic: 'An eye (Me in Japanese). It looks like a beautiful eye.', confusables: ['ぬ', 'あ'] },
    { char: 'も', romaji: 'mo', row: 'm', type: 'hiragana', strokeCount: 3, mnemonic: 'A Monitor lizard catching bugs with its tongue.', confusables: ['し'] },

    { char: 'や', romaji: 'ya', row: 'y', type: 'hiragana', strokeCount: 3, mnemonic: 'A Yak looking at you. You can see its horns.', confusables: ['か'] },
    { char: 'ゆ', romaji: 'yu', row: 'y', type: 'hiragana', strokeCount: 2, mnemonic: 'A U-turn sign on the road.', confusables: ['め'] },
    { char: 'よ', romaji: 'yo', row: 'y', type: 'hiragana', strokeCount: 2, mnemonic: 'Playing with a Yo-yo spinning down.', confusables: ['ま'] },

    { char: 'ら', romaji: 'ra', row: 'r', type: 'hiragana', strokeCount: 2, mnemonic: 'A Rabbit hopping on its hind legs.', confusables: ['ち', 'う'] },
    { char: 'り', romaji: 'ri', row: 'r', type: 'hiragana', strokeCount: 2, mnemonic: 'Reeds swaying in a river.', confusables: ['い'] },
    { char: 'る', romaji: 'ru', row: 'r', type: 'hiragana', strokeCount: 1, mnemonic: 'A Route on a map with a loop at the end.', confusables: ['ろ', 'そ'] },
    { char: 'れ', romaji: 're', row: 'r', type: 'hiragana', strokeCount: 2, mnemonic: 'A guy Resting against a wall.', confusables: ['わ', 'ね'] },
    { char: 'ろ', romaji: 'ro', row: 'r', type: 'hiragana', strokeCount: 1, mnemonic: 'A Road without a loop at the end.', confusables: ['る', 'そ'] },

    { char: 'わ', romaji: 'wa', row: 'w', type: 'hiragana', strokeCount: 2, mnemonic: 'A Wasp with a big rounded stinger.', confusables: ['れ', 'ね'] },
    { char: 'を', romaji: 'wo', row: 'w', type: 'hiragana', strokeCount: 3, mnemonic: 'A man going "Whoa!" as he rides a unicycle.', confusables: ['ち'] },
    { char: 'ん', romaji: 'n', row: 'w', type: 'hiragana', strokeCount: 1, mnemonic: 'Looks like a lowercase N stretching out at the end.', confusables: ['え'] }
  ],
  KATAKANA: [
    { char: 'ア', romaji: 'a', row: 'vowel', type: 'katakana', strokeCount: 2, mnemonic: 'An Axe chopping down.', confusables: ['マ', 'ヤ'] },
    { char: 'イ', romaji: 'i', row: 'vowel', type: 'katakana', strokeCount: 2, mnemonic: 'An Eagle standing on the ground.', confusables: ['ト', 'ナ'] },
    { char: 'ウ', romaji: 'u', row: 'vowel', type: 'katakana', strokeCount: 3, mnemonic: 'It looks like the top part of the hiragana う (u).', confusables: ['ワ', 'フ'] },
    { char: 'エ', romaji: 'e', row: 'vowel', type: 'katakana', strokeCount: 3, mnemonic: 'The girders of an Elevator shaft.', confusables: ['コ'] },
    { char: 'オ', romaji: 'o', row: 'vowel', type: 'katakana', strokeCount: 3, mnemonic: 'An Opera singer with his mouth wide open.', confusables: ['ホ', '木'] },

    { char: 'カ', romaji: 'ka', row: 'k', type: 'katakana', strokeCount: 2, mnemonic: 'Almost exactly like the hiragana か, minus the extra stroke.', confusables: ['力'] },
    { char: 'キ', romaji: 'ki', row: 'k', type: 'katakana', strokeCount: 3, mnemonic: 'Looks like a Key.', confusables: ['チ'] },
    { char: 'ク', romaji: 'ku', row: 'k', type: 'katakana', strokeCount: 2, mnemonic: 'A Cook\'s hat.', confusables: ['ワ', 'タ', 'ケ'] },
    { char: 'ケ', romaji: 'ke', row: 'k', type: 'katakana', strokeCount: 3, mnemonic: 'The shape of a Kettle.', confusables: ['ク'] },
    { char: 'コ', romaji: 'ko', row: 'k', type: 'katakana', strokeCount: 2, mnemonic: 'Two corners of a box. Box starts with... well, box, but it is a Corner.', confusables: ['ユ'] },

    { char: 'サ', romaji: 'sa', row: 's', type: 'katakana', strokeCount: 3, mnemonic: 'Three Sardines swimming together.', confusables: ['ザ'] },
    { char: 'シ', romaji: 'shi', row: 's', type: 'katakana', strokeCount: 3, mnemonic: 'She has a very weird face. Looking up from the bottom.', confusables: ['ツ', 'ン'] },
    { char: 'ス', romaji: 'su', row: 's', type: 'katakana', strokeCount: 2, mnemonic: 'Superman flying to the right.', confusables: ['ヌ'] },
    { char: 'セ', romaji: 'se', row: 's', type: 'katakana', strokeCount: 2, mnemonic: 'Looks like the hiragana せ (se) but sharper.', confusables: ['ヤ', 'ゼ'] },
    { char: 'ソ', romaji: 'so', row: 's', type: 'katakana', strokeCount: 2, mnemonic: 'Sewing with a single needle pointing down.', confusables: ['ン', 'シ'] },

    { char: 'タ', romaji: 'ta', row: 't', type: 'katakana', strokeCount: 3, mnemonic: 'A Tidal wave.', confusables: ['ク'] },
    { char: 'チ', romaji: 'chi', row: 't', type: 'katakana', strokeCount: 3, mnemonic: 'A Cheerleader doing a split.', confusables: ['テ'] },
    { char: 'ツ', romaji: 'tsu', row: 't', type: 'katakana', strokeCount: 3, mnemonic: 'Two needles pointing down. Falling rain.', confusables: ['シ', 'ソ'] },
    { char: 'テ', romaji: 'te', row: 't', type: 'katakana', strokeCount: 3, mnemonic: 'A Telephone pole.', confusables: ['チ'] },
    { char: 'ト', romaji: 'to', row: 't', type: 'katakana', strokeCount: 2, mnemonic: 'A Totem pole.', confusables: ['イ'] },

    { char: 'ナ', romaji: 'na', row: 'n', type: 'katakana', strokeCount: 2, mnemonic: 'A Nutcracker crossing its arms.', confusables: ['メ'] },
    { char: 'ニ', romaji: 'ni', row: 'n', type: 'katakana', strokeCount: 2, mnemonic: 'Two needles. "Ni" is two in Japanese.', confusables: ['二'] },
    { char: 'ヌ', romaji: 'nu', row: 'n', type: 'katakana', strokeCount: 2, mnemonic: 'A New pair of chopsticks picking up food.', confusables: ['ス'] },
    { char: 'ネ', romaji: 'ne', row: 'n', type: 'katakana', strokeCount: 4, mnemonic: 'A Nest in a tree.', confusables: ['ホ', 'ヘ'] },
    { char: 'ノ', romaji: 'no', row: 'n', type: 'katakana', strokeCount: 1, mnemonic: 'A long Nose.', confusables: ['ソ'] },

    { char: 'ハ', romaji: 'ha', row: 'h', type: 'katakana', strokeCount: 2, mnemonic: 'A Hat shape like a teepee.', confusables: ['八'] },
    { char: 'ヒ', romaji: 'hi', row: 'h', type: 'katakana', strokeCount: 2, mnemonic: 'He is sitting on the floor.', confusables: ['ミ'] },
    { char: 'フ', romaji: 'fu', row: 'h', type: 'katakana', strokeCount: 1, mnemonic: 'A big nose on a Fool.', confusables: ['ウ', 'ワ'] },
    { char: 'ヘ', romaji: 'he', row: 'h', type: 'katakana', strokeCount: 1, mnemonic: 'Exactly like the hiragana へ.', confusables: ['ネ', 'ホ'] },
    { char: 'ホ', romaji: 'ho', row: 'h', type: 'katakana', strokeCount: 4, mnemonic: 'A Holy cross.', confusables: ['ネ', 'オ', 'ヘ'] },

    { char: 'マ', romaji: 'ma', row: 'm', type: 'katakana', strokeCount: 2, mnemonic: 'A Mast on a boat.', confusables: ['ア', 'ム'] },
    { char: 'ミ', romaji: 'mi', row: 'm', type: 'katakana', strokeCount: 3, mnemonic: 'Three Missiles flying in a row.', confusables: ['ヒ', '三'] },
    { char: 'ム', romaji: 'mu', row: 'm', type: 'katakana', strokeCount: 2, mnemonic: 'A Moose antler.', confusables: ['マ'] },
    { char: 'メ', romaji: 'me', row: 'm', type: 'katakana', strokeCount: 2, mnemonic: 'An X-mark. X marks the spot for a Melon.', confusables: ['ナ', 'ノ'] },
    { char: 'モ', romaji: 'mo', row: 'm', type: 'katakana', strokeCount: 3, mnemonic: 'Looks similar to the hiragana も.', confusables: ['テ'] },

    { char: 'ヤ', romaji: 'ya', row: 'y', type: 'katakana', strokeCount: 2, mnemonic: 'A Yak without one of its horns.', confusables: ['セ', 'ア'] },
    { char: 'ユ', romaji: 'yu', row: 'y', type: 'katakana', strokeCount: 2, mnemonic: 'You are number one.', confusables: ['コ'] },
    { char: 'ヨ', romaji: 'yo', row: 'y', type: 'katakana', strokeCount: 3, mnemonic: 'A Yo-yo sliding down a string.', confusables: ['コ'] },

    { char: 'ラ', romaji: 'ra', row: 'r', type: 'katakana', strokeCount: 2, mnemonic: 'A Raptor wearing sunglasses.', confusables: ['フ'] },
    { char: 'リ', romaji: 'ri', row: 'r', type: 'katakana', strokeCount: 2, mnemonic: 'A River flowing down. Just like hiragana り.', confusables: ['ソ'] },
    { char: 'ル', romaji: 'ru', row: 'r', type: 'katakana', strokeCount: 2, mnemonic: 'Two Roots of a tree.', confusables: ['レ'] },
    { char: 'レ', romaji: 're', row: 'r', type: 'katakana', strokeCount: 1, mnemonic: 'A Red fish hook.', confusables: ['ル'] },
    { char: 'ロ', romaji: 'ro', row: 'r', type: 'katakana', strokeCount: 3, mnemonic: 'A square Room.', confusables: ['口'] },

    { char: 'ワ', romaji: 'wa', row: 'w', type: 'katakana', strokeCount: 2, mnemonic: 'A Wine glass missing a side.', confusables: ['ク', 'ウ', 'フ'] },
    { char: 'ヲ', romaji: 'wo', row: 'w', type: 'katakana', strokeCount: 3, mnemonic: 'A dog barking "Woof" with lines coming out of its mouth.', confusables: ['フ'] },
    { char: 'ン', romaji: 'n', row: 'w', type: 'katakana', strokeCount: 2, mnemonic: 'No! It looks like an N pointing up, but slanted. Looks like a face looking downwards.', confusables: ['ソ', 'シ'] }
  ],
  getConfusables: function(char) {
    const hiragana = this.HIRAGANA.find(k => k.char === char);
    if (hiragana) return hiragana.confusables;
    const katakana = this.KATAKANA.find(k => k.char === char);
    if (katakana) return katakana.confusables;
    return [];
  }
};
