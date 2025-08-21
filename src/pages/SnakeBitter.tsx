import { Link } from 'react-router-dom'

export default function SnakeBitter() {
  return (
    <main dir="rtl" className="bg-amber-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/" 
            className="text-xl text-blue-600 underline hover:text-blue-800 transition-colors"
          >
            ← חזרה
          </Link>
        </div>
        
        <h1 className="px-4 text-6xl md:text-8xl text-gray-500 border-b-4 text-center mb-8">
          נושך הנחשים
        </h1>

        <div className="max-w-4xl mx-auto space-y-12">
          {/* First section - Introduction */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-amber-200">
            <div>שרגא היה ילד רגיל,</div>
            <div>שאהב לנשוך נחשים.</div>
            <div>שרגא היה מתעורר בבוקר, ועוד לפני שהיה מצחצח שיניים,</div>
            <div>היה יוצא לחצר הענקית שלו ומחפש נחש לנשוך.</div>
          </div>

          {/* Second section - Morning routine */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-blue-200">
            <div>שרגא היה מחפש ומחפש עד שהיה מוצא נחש.</div>
            <div>ברגע ששרגא מצא נחש הוא היה</div>
            <div>תופס את זנב הנחש ביד ימין</div>
            <div>תופס את ראש הנחש ביד שמאל</div>
            <div>מותח את הנחש ונושך אותו ישר בבטן</div>
            <div>ואז ביד ימין מסובב את הנחש מעל הראש ווזרק אותו למרחק.</div>
            כך היה כל בוקר.
          </div>

          {/* Third section - Snakes coming for dinner */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-fuchsia-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/snakes-coming-for-dinner.png" 
                alt="Snakes coming for dinner" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>ערב אחד, נחשון הנחש השחור, עלה על הסלע הגדול בגינה.</div>
            <div>וצעקאאאס, נמאס נמאס נמאס.</div>
            <div>התגודדו כל הנחשים בגינה כדי לראות על מה כל המהומה.</div>
            <div>פתח נחשון ואמר: "עד מתי נהיה צעצוע נשיכה? נמאס!</div>
            <div>עד מתי ימתחו אותנו ויזרקו אותנו? נמאס!</div>
            <div>עד מתי נאלץ להתחבא כל בוקר? נמאס!"</div>
            <div>עלתה לצידו סימה הנחשה וקראה:</div>
            <div>"נחשים התאחדו. לא נסכים עוד. זיחלו אחרי"</div>
            <div>ירדה סימה מהסלע והחלה לזחול לעבר הבית של שרגא</div>
            וכל הנחשים הצטרפו אליה.
          </div>

          {/* Fourth section - Dinner scene */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-indigo-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/dinner.png" 
                alt="Dinner scene with snakes" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>בשעת ערב זו, ישבו שרגא ומשפחתו ואכלו ארוחת ערב.</div>
            <br />
            <div>הנחשים נכנסו ונערמו לערמה ענקית עד שהגיעו לגובה השולחן.</div>
            <div>ירדה סימה מראש הערמה ועלתה על שולחן ארוחת הערב,</div>
            <div>הסתכלה לשרגא בעינים ואמרה:</div>
            <div>"שרגא די, זה ממש לא נעים לנו."</div>
            <div>שרגא השפיל את עיניו ואמר בקול מבוייש:</div>
            <div>"סליחה."</div>
            <div>ואז הוסיף ואמר:</div>
            <div>"אני ממש מצטער, אני לא אנשך אף נחש</div>
            <div>יותר לעולם."</div>
            <div>סימה הנחשה ירדה מהשולחן אמרה שלום ויצאה.</div>
            <div>כל הנחשים יצאו וחזרו לביתם.</div>
            <br />
            אמא ואבא של שרגא אמרו לשרגא שהם גאים בו מאד על ההחלטה שלו.
          </div>

          {/* Fifth section - No biting allowed */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-lime-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/no-biting-allowed.png" 
                alt="No biting allowed sign" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>למחרת בבוקר שרגא התעורר וזכר מיד את הבטחתו לנחשים.</div>
            <div>הוא לא יצא לגינה לנשוך נחשים.</div>
            <div>גם לא למחרת, לא בשבוע שאחרי וכך עברו כמה חודשים...</div>
            <div>זה לא היה פשוט לשרגא כי שרגא ממש אהב לנשוך נחשים.</div>
            <div>
              <br />
            </div>
            <div>
              יום ההולדת של שרגא התקרב והנחשים שהיו אסירי תודה לשרגא על שהוא מקיים
              את הבטחתו החליטו לארגן לו הפתעה.
            </div>
          </div>

          {/* Sixth section - Birthday morning */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-yellow-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/birthday-morning.png" 
                alt="Birthday morning surprise" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>
              ביום ההולדת ששרגא התעורר הוא פקח את עיניו ולא האמין למראה עיניו.
            </div>
            <div>
              בחדר שלו היו אבא, אמא והמון המון נחשים וכולם קראו ביחד מזל טוב.
            </div>
            <div>
              ששון הנחש ניגש לשרגא ואמר מזל טוב, יש לנו משהו שאנחנו רוצים להראות
            </div>
            <div>לך בחצר. בוא איתנו בבקשה.</div>
          </div>

          {/* Seventh section - Boy and elephant */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-green-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/boy-and-elephant.png" 
                alt="Boy and elephant in the garden" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>יצא שרגא לחצר וכולם אחריו ושוב לא האמין שרגא למראה עיניו.</div>
            <div>הוא שיפשף את עיניו כדי לוודא שהן לא מתעתעות בו.</div>
            <div>
              אבל זה היה אמיתי, עדר פילים אפורים ענקים התבטל לו בנחת ואיטיות בחצר.
            </div>
            <div>
              <br />
            </div>
            <div>ששון הנחש חייך ואמר: קדימה שרגא, נסה לנשוך אחד.</div>
            <div>
              שרגא לא היסס לרגע, רץ לפיל הקרוב קפץ לו על הרגל ונתן נשיכה הגונה.
            </div>
            <div>
              שרגא הביט בפיל אבל הפיל לא הגיב הוא היה כל כך גדול ועם עור כל כך עבה
            </div>
            <div>שהוא בכלל לא הרגיש.</div>
            <div>
              <br />
            </div>
            <div>
              שרגא נתן עוד נשיכה ועוד נשיכה אפילו חזקה יותר ואז רץ וחיבק את כל
              הנחשים
            </div>
            <div>ואמר להם תודה ועוד פעם תודה ועוד פעם תודה.</div>
          </div>

          {/* Eighth section - Snake hug */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-pink-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/snake-hug.png" 
                alt="Snake hug" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div>
              ומאז כל בוקר, שרגא מתעורר, יוצא אל הגינה, אומר בוקר טוב לנחשים
            </div>
            <div>ונושך פיל או שניים לפני שהוא ממשיך את היום.</div>
            <div>
              <br />
            </div>
            <div>ונחשו מה?! הם חיו באושר ואושר עד עצם היום הזה.</div>
          </div>

          {/* Final section - Sorry */}
          <div className="px-6 md:px-12 text-gray-600 rounded-2xl py-6 text-2xl md:text-4xl whitespace-pre-wrap bg-purple-200">
            <div className="mb-6">
              <img 
                src="/snakes-story/sorry.png" 
                alt="Sorry message" 
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
            <div className="text-center text-3xl md:text-5xl font-bold">
              סוף טוב הכל טוב! 🐍🐘
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
