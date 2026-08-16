/**
 * Static trivia content for Quiz Duel — deliberately never sent over the wire. Both
 * clients bundle the exact same data, so pickQuestions() below only ever needs to
 * exchange a match id + two category ids to independently compute an identical
 * question set and order (see duel/quizEngine.ts's module doc for why that matters).
 * Questions are picked for being evergreen — no "current champion/record" style
 * facts that go stale.
 */

export interface QuizQuestion {
  q: string;
  options: [string, string, string, string];
  correct: number;
}

export interface QuizCategory {
  id: string;
  label: string;
  icon: string;
  questions: QuizQuestion[];
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
  {
    id: 'film',
    label: 'Film & TV',
    icon: '🎬',
    questions: [
      { q: 'Hvem instruerede filmen "Jaws" fra 1975?', options: ['Steven Spielberg', 'George Lucas', 'Ridley Scott', 'James Cameron'], correct: 0 },
      { q: 'Hvilken skuespiller spiller Iron Man/Tony Stark i Marvel-filmene?', options: ['Chris Evans', 'Robert Downey Jr.', 'Chris Hemsworth', 'Mark Ruffalo'], correct: 1 },
      { q: 'Hvad hedder den fiktive by hvor Batman kæmper mod forbrydelse?', options: ['Metropolis', 'Central City', 'Gotham City', 'Star City'], correct: 2 },
      { q: 'Hvilken tv-serie foregår primært i byen "Springfield"?', options: ['Family Guy', 'South Park', 'King of the Hill', 'The Simpsons'], correct: 3 },
      { q: 'Hvem spillede Jack Sparrow i "Pirates of the Caribbean"?', options: ['Johnny Depp', 'Orlando Bloom', 'Geoffrey Rush', 'Javier Bardem'], correct: 0 },
      { q: 'Hvilket studie står bag "Toy Story" og "Finding Nemo"?', options: ['DreamWorks', 'Illumination', 'Pixar', 'Blue Sky Studios'], correct: 2 },
      { q: 'Hvad hedder trilogien om ringen instrueret af Peter Jackson?', options: ['Ringenes Herre', 'Star Wars', 'Narnia', 'Harry Potter'], correct: 0 },
      { q: 'I hvilken by foregår tv-serien "Friends" primært?', options: ['Chicago', 'Los Angeles', 'Boston', 'New York'], correct: 3 },
      { q: 'Hvem spiller hovedrollen som Forrest Gump?', options: ['Tom Cruise', 'Tom Hanks', 'Kevin Costner', 'Robin Williams'], correct: 1 },
      { q: 'Hvilken instruktør står bag både "Titanic" og "Avatar"?', options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'], correct: 2 },
      { q: 'Hvad hedder hovedpersonen Walter til efternavn i "Breaking Bad"?', options: ['Pinkman', 'White', 'Schrader', 'Wexler'], correct: 1 },
      { q: 'Hvilken skuespiller lagde stemme til Shrek?', options: ['Eddie Murphy', 'Cameron Diaz', 'Mike Myers', 'John Lithgow'], correct: 2 },
      { q: 'Hvilken skuespiller spiller hovedrollen som Harry Potter i filmatiseringerne?', options: ['Rupert Grint', 'Daniel Radcliffe', 'Tom Felton', 'Matthew Lewis'], correct: 1 },
      { q: 'Hvad hedder den fiktive skole for troldmænd i Harry Potter?', options: ['Beauxbatons', 'Durmstrang', 'Hogwarts', 'Ilvermorny'], correct: 2 },
      { q: 'Hvilken instruktør står bag "Pulp Fiction" og "Kill Bill"?', options: ['Martin Scorsese', 'Quentin Tarantino', 'David Fincher', 'Christopher Nolan'], correct: 1 },
      { q: 'Hvilken tv-serie handler om drageklaner og magt i det fiktive land Westeros?', options: ['The Witcher', 'Vikings', 'Game of Thrones', 'House of Cards'], correct: 2 },
      { q: 'Hvem spiller hovedrollen som Neo i "The Matrix"?', options: ['Keanu Reeves', 'Brad Pitt', 'Will Smith', 'Tom Cruise'], correct: 0 },
      { q: 'Hvilket dyr er hovedpersonen i den animerede Disney-film "Bambi"?', options: ['En kanin', 'En hjort', 'En ræv', 'En bjørn'], correct: 1 },
      { q: 'Hvad hedder den grønne kæmpe fra Marvel-universet, der bliver stærkere når han bliver vred?', options: ['Thor', 'Groot', 'Hulk', 'Beast'], correct: 2 },
      { q: 'Hvilken skuespiller spillede The Joker i filmen "The Dark Knight" fra 2008?', options: ['Jared Leto', 'Joaquin Phoenix', 'Heath Ledger', 'Jack Nicholson'], correct: 2 },
      { q: 'Hvilken tv-serie om et fiktivt sygehus i Seattle hedder noget med "Grey\'s"?', options: ['ER', 'House', 'Scrubs', 'Grey\'s Anatomy'], correct: 3 },
      { q: 'Hvad hedder rumskibet, som Kirk og Spock rejser med i "Star Trek"?', options: ['Millennium Falcon', 'USS Enterprise', 'Serenity', 'Nostromo'], correct: 1 },
      { q: 'Hvilken dansk instruktør står bag filmen "Festen" og Dogme 95-bevægelsen?', options: ['Lars von Trier', 'Susanne Bier', 'Thomas Vinterberg', 'Nicolas Winding Refn'], correct: 2 },
      { q: 'Hvad hedder hovedpersonen i tv-serien "Sherlock" (BBC), som løser mysterier i London?', options: ['John Watson', 'Sherlock Holmes', 'Mycroft Holmes', 'Moriarty'], correct: 1 },
      { q: 'Hvilket filmstudie står bag superheltefilmene om Batman, Superman og Wonder Woman (DC)?', options: ['Universal', 'Warner Bros.', 'Sony', 'Paramount'], correct: 1 },
    ],
  },
  {
    id: 'musik',
    label: 'Musik',
    icon: '🎵',
    questions: [
      { q: 'Hvilket band skrev og indspillede "Bohemian Rhapsody"?', options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd'], correct: 1 },
      { q: 'Hvem kaldes ofte "The King of Pop"?', options: ['Elvis Presley', 'Prince', 'Michael Jackson', 'James Brown'], correct: 2 },
      { q: 'Hvilket instrument spillede Jimi Hendrix primært?', options: ['Trommer', 'Guitar', 'Klaver', 'Bas'], correct: 1 },
      { q: 'Hvilken sanger står bag det ikoniske album "Thriller"?', options: ['Prince', 'Stevie Wonder', 'Lionel Richie', 'Michael Jackson'], correct: 3 },
      { q: 'Hvilket dansk band skrev og indspillede "Barbie Girl"?', options: ['Alphabeat', 'Aqua', 'Michael Learns to Rock', 'D-A-D'], correct: 1 },
      { q: 'Hvor mange strenge har en almindelig (akustisk/el-) guitar typisk?', options: ['4', '5', '6', '7'], correct: 2 },
      { q: 'Hvilken gruppe bestod Beyoncé oprindeligt af, før sin solo-karriere?', options: ['TLC', 'Destiny\'s Child', 'En Vogue', 'Spice Girls'], correct: 1 },
      { q: 'Hvilken genre er Wolfgang Amadeus Mozart mest kendt for?', options: ['Jazz', 'Rock', 'Klassisk musik', 'Blues'], correct: 2 },
      { q: 'I hvilket årti udkom Nirvanas gennembrudsalbum "Nevermind"?', options: ['1970\'erne', '1980\'erne', '1990\'erne', '2000\'erne'], correct: 2 },
      { q: 'Hvem synger den store hitsingle "Rolling in the Deep"?', options: ['Amy Winehouse', 'Adele', 'Sam Smith', 'Duffy'], correct: 1 },
      { q: 'Hvilket strygeinstrument er en cello i familie med?', options: ['Trompet', 'Violin', 'Fløjte', 'Guitar'], correct: 1 },
      { q: 'Hvilken svensk gruppe skrev og indspillede "Dancing Queen"?', options: ['Roxette', 'Ace of Base', 'ABBA', 'Europe'], correct: 2 },
      { q: 'Hvilken amerikansk sangerinde er kendt som "Queen of Pop"?', options: ['Britney Spears', 'Madonna', 'Cher', 'Mariah Carey'], correct: 1 },
      { q: 'Hvilket britisk band skrev og indspillede "Hey Jude" og "Let It Be"?', options: ['The Beatles', 'The Rolling Stones', 'The Who', 'Pink Floyd'], correct: 0 },
      { q: 'Hvilket instrument spillede jazzlegenden Louis Armstrong primært?', options: ['Saxofon', 'Trompet', 'Klarinet', 'Klaver'], correct: 1 },
      { q: 'Hvilken amerikansk rapper og forretningsmand hedder Shawn Carter til borgerligt navn?', options: ['Kanye West', 'Eminem', 'Jay-Z', 'Drake'], correct: 2 },
      { q: 'I hvilket årti blev disco-musikken særligt populær?', options: ['1960\'erne', '1970\'erne', '1980\'erne', '1990\'erne'], correct: 1 },
      { q: 'Hvilket land kommer musikgenren reggae oprindeligt fra?', options: ['Cuba', 'Jamaica', 'Brasilien', 'Trinidad'], correct: 1 },
      { q: 'Hvilken komponist skrev "Til Elise" og "Skæbnesymfonien"?', options: ['Wolfgang Amadeus Mozart', 'Ludwig van Beethoven', 'Johann Sebastian Bach', 'Franz Schubert'], correct: 1 },
      { q: 'Hvilken dansk sangerinde vandt Melodi Grand Prix/Eurovision i 2013 med "Only Teardrops"?', options: ['Anja Nissen', 'Emmelie de Forest', 'Basim', 'Rasmussen'], correct: 1 },
      { q: 'Hvor mange grundlæggende nodenavne (A til G) er der i den vestlige musikskala?', options: ['5', '6', '7', '8'], correct: 2 },
      { q: 'Hvilken sanger skrev og indspillede "Billie Jean"?', options: ['Prince', 'George Michael', 'Michael Jackson', 'Lionel Richie'], correct: 2 },
      { q: 'Hvilket britisk band har Mick Jagger og Keith Richards som medlemmer?', options: ['The Beatles', 'The Rolling Stones', 'The Who', 'Led Zeppelin'], correct: 1 },
      { q: 'Hvilken sangerinde er kendt for hittet "Shallow" fra filmen "A Star Is Born"?', options: ['Ariana Grande', 'Katy Perry', 'Lady Gaga', 'Rihanna'], correct: 2 },
      { q: 'Hvilket instrument har typisk 88 tangenter?', options: ['Harpe', 'Klaver', 'Orgel', 'Xylofon'], correct: 1 },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    icon: '⚽',
    questions: [
      { q: 'Hvor mange spillere har hvert hold på banen i fodbold (inkl. målmand)?', options: ['9', '10', '11', '12'], correct: 2 },
      { q: 'Hvilket land har (pr. 2022) vundet flest VM-titler i fodbold for herrer?', options: ['Tyskland', 'Italien', 'Brasilien', 'Argentina'], correct: 2 },
      { q: 'Hvor mange point giver et "touchdown" i amerikansk fodbold, uden ekstraforsøg?', options: ['3', '6', '7', '8'], correct: 1 },
      { q: 'I hvilken sport bruger man en "shuttlecock" (fjerbold)?', options: ['Tennis', 'Squash', 'Badminton', 'Bordtennis'], correct: 2 },
      { q: 'Hvor mange sæt skal en spiller vinde for at vinde en herresingle-finale ved en Grand Slam-turnering?', options: ['2', '3', '4', '5'], correct: 1 },
      { q: 'Hvilken sport konkurreres der i under cykelløbet "Tour de France"?', options: ['Løb', 'Cykling', 'Svømning', 'Motorsport'], correct: 1 },
      { q: 'Hvor mange ringe indgår i det olympiske symbol?', options: ['4', '5', '6', '7'], correct: 1 },
      { q: 'Hvilket land regnes traditionelt som cricketsportens oprindelsesland?', options: ['Indien', 'England', 'Australien', 'Sydafrika'], correct: 1 },
      { q: 'Hvor lang er en maraton cirka?', options: ['21 km', '32 km', '42 km', '50 km'], correct: 2 },
      { q: 'I hvilken sport konkurrerer man i discipliner som "frit opgør" og "græsk-romersk"?', options: ['Boksning', 'Brydning', 'Judo', 'Karate'], correct: 1 },
      { q: 'Hvor mange spillere har hvert hold på banen samtidig i basketball?', options: ['4', '5', '6', '7'], correct: 1 },
      { q: 'Hvor mange perioder ("periods") spiller man normalt i en ishockeykamp?', options: ['2', '3', '4', '5'], correct: 1 },
      { q: 'Hvilken sport bruger man en "puck" i stedet for en bold?', options: ['Ishockey', 'Bandy', 'Curling', 'Lacrosse'], correct: 0 },
      { q: 'Hvor ofte afholdes de olympiske sommerlege normalt?', options: ['Hvert 2. år', 'Hvert 3. år', 'Hvert 4. år', 'Hvert 5. år'], correct: 2 },
      { q: 'Hvilken sport spiller man traditionelt til turneringen Wimbledon?', options: ['Squash', 'Badminton', 'Tennis', 'Bordtennis'], correct: 2 },
      { q: 'Hvor mange huller er der normalt på en golfbane i en fuld runde?', options: ['9', '12', '18', '24'], correct: 2 },
      { q: 'I hvilken sport bruger man udtrykket "hole in one"?', options: ['Golf', 'Bowling', 'Billard', 'Dart'], correct: 0 },
      { q: 'Hvor mange spillere har hvert hold på banen samtidig i volleyball?', options: ['4', '5', '6', '7'], correct: 2 },
      { q: 'Hvilket land er Formel 1-løbet "Monaco Grand Prix" opkaldt efter?', options: ['Frankrig', 'Monaco', 'Italien', 'Belgien'], correct: 1 },
      { q: 'Hvor lang er en olympisk svømmebane typisk?', options: ['25 meter', '50 meter', '100 meter', '200 meter'], correct: 1 },
      { q: 'Hvilken sport dyrker man på en "pist"?', options: ['Skøjteløb', 'Skiløb', 'Rulleskøjteløb', 'Cykling'], correct: 1 },
      { q: 'Hvad kaldes det, når en bokser vinder ved at slå modstanderen ud?', options: ['Teknisk sejr', 'Knockout', 'Diskvalifikation', 'Pointsejr'], correct: 1 },
      { q: 'Hvilken sport foregår i en bane kaldet en "ring"?', options: ['Brydning', 'Fægtning', 'Boksning', 'Judo'], correct: 2 },
      { q: 'Hvor mange spillere har hvert hold på banen samtidig i håndbold (inkl. målmand)?', options: ['6', '7', '8', '9'], correct: 1 },
      { q: 'Hvilket land vandt det allerførste fodbold-VM i 1930?', options: ['Brasilien', 'Argentina', 'Italien', 'Uruguay'], correct: 3 },
    ],
  },
  {
    id: 'historie',
    label: 'Historie',
    icon: '📜',
    questions: [
      { q: 'I hvilket år faldt Berlinmuren?', options: ['1985', '1987', '1989', '1991'], correct: 2 },
      { q: 'Hvem var USA\'s første præsident?', options: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'], correct: 1 },
      { q: 'Vikingetiden i Danmark regnes typisk til at strække sig over hvilken periode?', options: ['6.-9. århundrede', '8.-11. århundrede', '10.-13. århundrede', '12.-15. århundrede'], correct: 1 },
      { q: 'I hvilket år startede 2. Verdenskrig?', options: ['1914', '1929', '1939', '1945'], correct: 2 },
      { q: 'Hvem malede loftet i Det Sixtinske Kapel?', options: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'], correct: 1 },
      { q: 'Hvilket imperium byggede Colosseum i Rom?', options: ['Romerriget', 'Det Osmanniske Rige', 'Det Byzantinske Rige', 'Det Persiske Rige'], correct: 0 },
      { q: 'Hvem var Danmarks konge under det meste af 2. Verdenskrig?', options: ['Frederik IX', 'Christian IX', 'Christian X', 'Frederik VIII'], correct: 2 },
      { q: 'I hvilket land opfandt Gutenberg den europæiske trykpresse?', options: ['Italien', 'Tyskland', 'Frankrig', 'England'], correct: 1 },
      { q: 'I hvilket år landede mennesket først på månen?', options: ['1965', '1969', '1972', '1975'], correct: 1 },
      { q: 'I hvilket år blev enevælden indført i Danmark?', options: ['1620', '1660', '1700', '1746'], correct: 1 },
      { q: 'Hvilken dronning fejrede 50 års regeringsjubilæum i Danmark i 2022?', options: ['Margrethe I', 'Anne-Marie', 'Margrethe II', 'Ingrid'], correct: 2 },
      { q: 'Hvilken opfindelse tilskrives typisk Johannes Gutenberg?', options: ['Trykpressen', 'Dampmaskinen', 'Glødepæren', 'Telefonen'], correct: 0 },
      { q: 'Hvilket år blev den danske grundlov underskrevet første gang?', options: ['1814', '1849', '1864', '1901'], correct: 1 },
      { q: 'Hvilken oldtidscivilisation byggede pyramiderne i Giza?', options: ['De gamle egyptere', 'Mayaerne', 'Romerne', 'Grækerne'], correct: 0 },
      { q: 'Hvem var lederen af Sovjetunionen under det meste af 2. Verdenskrig?', options: ['Vladimir Lenin', 'Josef Stalin', 'Leon Trotskij', 'Nikita Khrusjtjov'], correct: 1 },
      { q: 'I hvilket år sluttede 1. Verdenskrig?', options: ['1914', '1916', '1918', '1920'], correct: 2 },
      { q: 'Hvilken opdagelsesrejsende krediteres traditionelt for at have nået Amerika i 1492?', options: ['Marco Polo', 'Christoffer Columbus', 'Vasco da Gama', 'Ferdinand Magellan'], correct: 1 },
      { q: 'I hvilket år mistede Danmark Norge til Sverige ved Kielerfreden?', options: ['1801', '1814', '1848', '1864'], correct: 1 },
      { q: 'Hvilken engelsk dronning regerede i over 60 år og gav navn til den victorianske æra?', options: ['Dronning Elizabeth I', 'Dronning Anne', 'Dronning Victoria', 'Dronning Mary'], correct: 2 },
      { q: 'Hvilket oldtidsrige er kendt for faraoer, pyramider og floden Nilen?', options: ['Det gamle Egypten', 'Mesopotamien', 'Persien', 'Fønikien'], correct: 0 },
      { q: 'Hvad kaldes perioden med genopblomstring af kunst og videnskab efter middelalderen?', options: ['Renæssancen', 'Oplysningstiden', 'Reformationen', 'Barokken'], correct: 0 },
      { q: 'Hvilken mur delte Øst- og Vesttyskland fra 1961 til 1989?', options: ['Berlinmuren', 'Maginotlinjen', 'Den Kinesiske Mur', 'Hadrians Mur'], correct: 0 },
      { q: 'Hvilket år blev Danmark medlem af EF (nu EU)?', options: ['1957', '1973', '1986', '1993'], correct: 1 },
      { q: 'Hvilken religiøs bevægelse startede Martin Luther i 1517?', options: ['Renæssancen', 'Oplysningstiden', 'Reformationen', 'Korstogene'], correct: 2 },
      { q: 'Hvem krediteres oftest for at have opfundet glødepæren?', options: ['Nikola Tesla', 'Thomas Edison', 'Alexander Graham Bell', 'Benjamin Franklin'], correct: 1 },
    ],
  },
  {
    id: 'geografi',
    label: 'Geografi',
    icon: '🌍',
    questions: [
      { q: 'Hvad er hovedstaden i Australien?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correct: 2 },
      { q: 'Hvilken flod regnes traditionelt som verdens længste?', options: ['Amazonfloden', 'Nilen', 'Yangtzefloden', 'Mississippi'], correct: 1 },
      { q: 'Hvor mange kontinenter er der traditionelt set?', options: ['5', '6', '7', '8'], correct: 2 },
      { q: 'Hvilket land har flest indbyggere i verden (pr. 2023)?', options: ['Kina', 'USA', 'Indien', 'Indonesien'], correct: 2 },
      { q: 'Hvad hedder verdens højeste bjerg?', options: ['K2', 'Kilimanjaro', 'Mount Everest', 'Denali'], correct: 2 },
      { q: 'Hvilket hav ligger mellem Europa og Nordamerika?', options: ['Stillehavet', 'Atlanterhavet', 'Det Indiske Ocean', 'Middelhavet'], correct: 1 },
      { q: 'Hvilket land kaldes ofte "Den Opgående Sols Land"?', options: ['Kina', 'Japan', 'Sydkorea', 'Thailand'], correct: 1 },
      { q: 'Hvor mange lande grænser op til Danmark til lands?', options: ['0', '1', '2', '3'], correct: 1 },
      { q: 'Hvad er verdens mindste land målt på areal?', options: ['Monaco', 'San Marino', 'Vatikanstaten', 'Liechtenstein'], correct: 2 },
      { q: 'Hvilken ørken regnes som verdens største varme ørken?', options: ['Gobi', 'Kalahari', 'Atacama', 'Sahara'], correct: 3 },
      { q: 'Hvilket land har flest officielle tidszoner, primært pga. oversøiske territorier?', options: ['Rusland', 'USA', 'Frankrig', 'Kina'], correct: 2 },
      { q: 'Hvad hedder hovedstaden i Canada?', options: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], correct: 3 },
      { q: 'Hvad er hovedstaden i Frankrig?', options: ['Paris', 'Lyon', 'Marseille', 'Nice'], correct: 0 },
      { q: 'Hvad er hovedstaden i Tyskland?', options: ['München', 'Berlin', 'Hamborg', 'Frankfurt'], correct: 1 },
      { q: 'Hvilken verdensdel ligger Sahara-ørkenen i?', options: ['Afrika', 'Asien', 'Sydamerika', 'Australien'], correct: 0 },
      { q: 'Hvad er verdens dybeste havgrav?', options: ['Puerto Rico-graven', 'Java-graven', 'Marianergraven', 'Tonga-graven'], correct: 2 },
      { q: 'Hvilket land er kendt som "Nedlandene" og ligger delvist under havets overflade?', options: ['Belgien', 'Holland', 'Danmark', 'Tyskland'], correct: 1 },
      { q: 'Hvad hedder den længste bjergkæde i verden, beliggende i Sydamerika?', options: ['Klippebjergene', 'Alperne', 'Andesbjergene', 'Himalaya'], correct: 2 },
      { q: 'Hvilket land har byerne Sydney og Melbourne som sine to største byer?', options: ['New Zealand', 'Australien', 'Sydafrika', 'Canada'], correct: 1 },
      { q: 'Hvad er hovedstaden i Egypten?', options: ['Alexandria', 'Giza', 'Cairo', 'Luxor'], correct: 2 },
      { q: 'Hvilken flod løber gennem Paris?', options: ['Rhônen', 'Loire', 'Seinen', 'Rhinen'], correct: 2 },
      { q: 'Hvilket hav er størst målt på areal?', options: ['Stillehavet', 'Atlanterhavet', 'Det Indiske Ocean', 'Det Arktiske Ocean'], correct: 0 },
      { q: 'Hvor mange have/oceaner regnes der traditionelt med i verden?', options: ['3', '4', '5', '6'], correct: 2 },
      { q: 'Hvad er hovedstaden i Spanien?', options: ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'], correct: 1 },
      { q: 'Hvilken ø er verdens største målt på areal?', options: ['New Guinea', 'Borneo', 'Grønland', 'Madagaskar'], correct: 2 },
    ],
  },
  {
    id: 'videnskab',
    label: 'Videnskab',
    icon: '🔬',
    questions: [
      { q: 'Hvad er det kemiske symbol for guld?', options: ['Au', 'Ag', 'Gd', 'Go'], correct: 0 },
      { q: 'Hvor mange planeter er der i vores solsystem, siden Pluto blev nedgraderet?', options: ['7', '8', '9', '10'], correct: 1 },
      { q: 'Hvad kaldes processen, hvor planter omdanner sollys til energi?', options: ['Respiration', 'Osmose', 'Fotosyntese', 'Fordampning'], correct: 2 },
      { q: 'Hvem formulerede tyngdeloven, ifølge historien inspireret af et faldende æble?', options: ['Albert Einstein', 'Isaac Newton', 'Galileo Galilei', 'Charles Darwin'], correct: 1 },
      { q: 'Hvad er den kemiske formel for almindeligt vand?', options: ['H2O', 'CO2', 'O2', 'NaCl'], correct: 0 },
      { q: 'Hvilket organ i kroppen pumper blodet rundt?', options: ['Lungerne', 'Hjertet', 'Leveren', 'Nyrerne'], correct: 1 },
      { q: 'Hvad kaldes den mindste enhed af et grundstof?', options: ['Molekyle', 'Celle', 'Atom', 'Elektron'], correct: 2 },
      { q: 'Hvor mange knogler har et voksent menneske normalt?', options: ['186', '196', '206', '216'], correct: 2 },
      { q: 'Hvilken gas udgør størstedelen af Jordens atmosfære?', options: ['Ilt', 'Kvælstof', 'Kuldioxid', 'Brint'], correct: 1 },
      { q: 'Hvem er primært kendt for at have udviklet evolutionsteorien om naturlig udvælgelse?', options: ['Gregor Mendel', 'Louis Pasteur', 'Charles Darwin', 'Alfred Wallace'], correct: 2 },
      { q: 'Hvad måler man med et termometer?', options: ['Tryk', 'Temperatur', 'Fugtighed', 'Vægt'], correct: 1 },
      { q: 'Hvilken planet er kendt som "den røde planet"?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
      { q: 'Hvad kaldes kraften, der trækker objekter mod Jordens centrum?', options: ['Friktion', 'Tyngdekraft', 'Magnetisme', 'Elektricitet'], correct: 1 },
      { q: 'Hvilket grundstof har det kemiske symbol "O"?', options: ['Osmium', 'Ilt', 'Guld', 'Brint'], correct: 1 },
      { q: 'Hvor mange kromosomer har et normalt menneske typisk, samlet antal?', options: ['23', '44', '46', '48'], correct: 2 },
      { q: 'Hvad kaldes studiet af stjerner, planeter og universet?', options: ['Astronomi', 'Astrologi', 'Geologi', 'Meteorologi'], correct: 0 },
      { q: 'Hvilken videnskabsmand udviklede den generelle relativitetsteori?', options: ['Isaac Newton', 'Niels Bohr', 'Albert Einstein', 'Stephen Hawking'], correct: 2 },
      { q: 'Hvad kaldes processen, hvor vand skifter fra flydende form til damp?', options: ['Fordampning', 'Kondensering', 'Frysning', 'Smeltning'], correct: 0 },
      { q: 'Hvilken dansk fysiker modtog Nobelprisen i fysik i 1922 for sit arbejde med atomets struktur?', options: ['Ole Rømer', 'Tycho Brahe', 'Niels Bohr', 'Hans Christian Ørsted'], correct: 2 },
      { q: 'Hvor mange sanser regnes der traditionelt med hos mennesket?', options: ['4', '5', '6', '7'], correct: 1 },
      { q: 'Hvad kaldes den mindste levende byggesten i alle organismer?', options: ['Atomet', 'Molekylet', 'Cellen', 'Vævet'], correct: 2 },
      { q: 'Hvilken gas har mennesker og dyr brug for at indånde for at overleve?', options: ['Kvælstof', 'Ilt', 'Kuldioxid', 'Helium'], correct: 1 },
      { q: 'Hvad måler man på Richterskalaen?', options: ['Vindstyrke', 'Temperatur', 'Jordskælvs styrke', 'Lydstyrke'], correct: 2 },
      { q: 'Hvilket organ renser blodet for affaldsstoffer og producerer urin?', options: ['Leveren', 'Nyrerne', 'Lungerne', 'Milten'], correct: 1 },
      { q: 'Hvad kaldes processen, hvor celler deler sig for at skabe nye celler?', options: ['Celledeling', 'Fotosyntese', 'Respiration', 'Fordøjelse'], correct: 0 },
    ],
  },
  {
    id: 'mad',
    label: 'Mad & Drikke',
    icon: '🍔',
    questions: [
      { q: 'Hvilket land stammer retten sushi oprindeligt fra?', options: ['Kina', 'Japan', 'Thailand', 'Korea'], correct: 1 },
      { q: 'Hvad er hovedingrediensen i traditionel guacamole?', options: ['Tomat', 'Løg', 'Avocado', 'Lime'], correct: 2 },
      { q: 'Hvilken drik fremstilles ved at gære druer?', options: ['Øl', 'Vin', 'Cider', 'Whisky'], correct: 1 },
      { q: 'Hvilket land stammer pizza oprindeligt fra?', options: ['Grækenland', 'Italien', 'Frankrig', 'Spanien'], correct: 1 },
      { q: 'Hvad er hovedingrediensen i en klassisk dansk frikadelle?', options: ['Fisk', 'Hakket kød', 'Kartofler', 'Ris'], correct: 1 },
      { q: 'Hvilket krydderi, der kommer fra planten Crocus sativus, regnes som verdens dyreste?', options: ['Kanel', 'Vanilje', 'Safran', 'Peber'], correct: 2 },
      { q: 'Hvilken nød bruges typisk til at lave traditionel marcipan?', options: ['Hasselnødder', 'Valnødder', 'Mandler', 'Cashewnødder'], correct: 2 },
      { q: 'Hvad kaldes en kok, der specialiserer sig i bagværk og desserter?', options: ['Sommelier', 'Konditor', 'Slagter', 'Sous-chef'], correct: 1 },
      { q: 'Hvilken drik er kendt som verdens mest solgte kulsyreholdige læskedrik?', options: ['Pepsi', 'Fanta', 'Coca-Cola', 'Sprite'], correct: 2 },
      { q: 'Hvad er den primære ingrediens i traditionel hummus?', options: ['Linser', 'Bønner', 'Kikærter', 'Majs'], correct: 2 },
      { q: 'Hvilket land regnes som oprindelsen til retten tacos?', options: ['Spanien', 'Mexico', 'Peru', 'Brasilien'], correct: 1 },
      { q: 'Hvad kaldes retten, hvor rå fisk marineres i citrusjuice, populær i Latinamerika?', options: ['Sashimi', 'Tartar', 'Ceviche', 'Carpaccio'], correct: 2 },
      { q: 'Hvilket land regnes som oprindelsen til den klassiske "curry"-ret?', options: ['Thailand', 'Indien', 'Kina', 'Pakistan'], correct: 1 },
      { q: 'Hvad er hovedingrediensen i traditionel dansk "gule ærter"?', options: ['Ærter', 'Bønner', 'Linser', 'Majs'], correct: 0 },
      { q: 'Hvilken drik fremstilles ved at brygge og gære korn, typisk byg?', options: ['Vin', 'Øl', 'Cider', 'Mjød'], correct: 1 },
      { q: 'Hvad kaldes den franske teknik at stege mad hurtigt ved høj varme i lidt fedtstof?', options: ['Braisering', 'Pochering', 'Sautering', 'Confitering'], correct: 2 },
      { q: 'Hvilket land stammer retten paella oprindeligt fra?', options: ['Italien', 'Spanien', 'Portugal', 'Grækenland'], correct: 1 },
      { q: 'Hvilken frugt bruges til at lave traditionel vin?', options: ['Druer', 'Æbler', 'Blommer', 'Kirsebær'], correct: 0 },
      { q: 'Hvad kaldes en ret af fint hakket rå oksekød, ofte serveret med æggeblomme?', options: ['Carpaccio', 'Ceviche', 'Tatar', 'Tapas'], correct: 2 },
      { q: 'Hvilket land er verdens største producent af kaffe?', options: ['Colombia', 'Vietnam', 'Etiopien', 'Brasilien'], correct: 3 },
      { q: 'Hvad kaldes den italienske ris-ret, der røres konstant under tilberedning i bouillon?', options: ['Paella', 'Risotto', 'Pilaf', 'Couscous'], correct: 1 },
      { q: 'Hvilket krydderi kommer fra tørrede blomsterknopper og bruges ofte i julebag?', options: ['Kanel', 'Muskat', 'Nelliker', 'Ingefær'], correct: 2 },
      { q: 'Hvad er hovedingrediensen i den franske grøntsagsret "ratatouille"?', options: ['Grøntsager', 'Kød', 'Fisk', 'Bønner'], correct: 0 },
      { q: 'Hvilken drik er traditionelt forbundet med engelsk "afternoon tea" klokken 16?', options: ['Kaffe', 'Sherry', 'Te', 'Portvin'], correct: 2 },
    ],
  },
  {
    id: 'spil',
    label: 'Videospil',
    icon: '🎮',
    questions: [
      { q: 'Hvilket firma producerer spillekonsollen PlayStation?', options: ['Microsoft', 'Sony', 'Nintendo', 'Sega'], correct: 1 },
      { q: 'Hvad hedder hovedpersonen i "Super Mario"-spillene?', options: ['Luigi', 'Bowser', 'Mario', 'Yoshi'], correct: 2 },
      { q: 'Hvilket spil er kendt for en verden bygget af kubiske blokke, man selv kan bygge med?', options: ['Roblox', 'Terraria', 'Minecraft', 'Fortnite'], correct: 2 },
      { q: 'Hvilket firma udgiver "Call of Duty"-serien?', options: ['EA', 'Ubisoft', 'Activision', 'Rockstar'], correct: 2 },
      { q: 'Hvad hedder den grønne dinosaur, som er Marios ven og følgesvend?', options: ['Toad', 'Luigi', 'Wario', 'Yoshi'], correct: 3 },
      { q: 'Hvilket spilfirma står bag "The Legend of Zelda"?', options: ['Sony', 'Nintendo', 'Sega', 'Capcom'], correct: 1 },
      { q: 'Hvad kaldes den spiltype, hvor mange spillere kæmper mod hinanden, indtil kun én er tilbage?', options: ['Sandkasse', 'Battle royale', 'RPG', 'Platformer'], correct: 1 },
      { q: 'Hvilket lille studie udgav oprindeligt "Minecraft", før Microsoft opkøbte det?', options: ['Valve', 'EA', 'Mojang', 'Blizzard'], correct: 2 },
      { q: 'Hvad hedder hovedkarakteren, man typisk styrer i "The Legend of Zelda"-spillene?', options: ['Zelda', 'Ganon', 'Link', 'Navi'], correct: 2 },
      { q: 'Hvilket firma står bag den populære pc-spilplatform "Steam"?', options: ['EA', 'Ubisoft', 'Valve', 'Epic Games'], correct: 2 },
      { q: 'Hvad kaldes det, når man spiller et spil uden internetforbindelse?', options: ['Online', 'LAN', 'Cloud', 'Offline'], correct: 3 },
      { q: 'Hvilket populært battle royale-spil er udviklet af Epic Games?', options: ['Apex Legends', 'PUBG', 'Fortnite', 'Valorant'], correct: 2 },
      { q: 'Hvilket firma udvikler fodboldspilserien "EA Sports FC" (tidligere FIFA)?', options: ['Ubisoft', '2K', 'EA', 'Konami'], correct: 2 },
      { q: 'Hvad hedder hovedkarakteren i "Sonic"-spilserien?', options: ['Tails', 'Sonic the Hedgehog', 'Knuckles', 'Shadow'], correct: 1 },
      { q: 'Hvilket firma producerer spillekonsollen Xbox?', options: ['Sony', 'Microsoft', 'Nintendo', 'Sega'], correct: 1 },
      { q: 'Hvad kaldes den spiltype, hvor man bygger og styrer en by eller civilisation, fx "Civilization"?', options: ['Strategispil', 'Platformer', 'Skydespil', 'Eventyrspil'], correct: 0 },
      { q: 'Hvilket spil populariserede battle royale-genren i stor skala, før Fortnite?', options: ['Apex Legends', 'PUBG', 'Warzone', 'Fall Guys'], correct: 1 },
      { q: 'Hvad hedder den fiktive by, hvor det meste af "Grand Theft Auto V" foregår?', options: ['Vice City', 'Liberty City', 'Los Santos', 'San Fierro'], correct: 2 },
      { q: 'Hvilket firma udvikler "League of Legends"?', options: ['Riot Games', 'Blizzard', 'Valve', 'Epic Games'], correct: 0 },
      { q: 'Hvilket firma står bag spilserien "World of Warcraft"?', options: ['Valve', 'EA', 'Blizzard Entertainment', 'Ubisoft'], correct: 2 },
      { q: 'Hvilket Rockstar Games-spil foregår i det vilde vesten med hovedpersonen Arthur Morgan?', options: ['GTA V', 'Red Dead Redemption 2', 'Days Gone', 'Cyberpunk 2077'], correct: 1 },
      { q: 'Hvilket firma udgiver spilserien "Assassin\'s Creed"?', options: ['EA', 'Activision', 'Ubisoft', 'Square Enix'], correct: 2 },
      { q: 'Hvad kaldes det, når man spiller et spil via en skærmforbindelse i stedet for at eje det lokalt?', options: ['LAN gaming', 'Offline gaming', 'Split-screen', 'Cloud gaming'], correct: 3 },
      { q: 'Hvilket japansk firma står bag spilserien "Final Fantasy"?', options: ['Capcom', 'Konami', 'Square Enix', 'Namco'], correct: 2 },
    ],
  },
];

/** djb2-style string hash → 32-bit seed, so a deterministic PRNG can be seeded purely
 * from the match id both clients already agree on (no coordination round-trip needed). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough-for-a-quiz-shuffle PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PickedQuestion {
  categoryId: string;
  question: QuizQuestion;
}

/**
 * Deterministic — both clients call this with the same (matchId, senderCategoryId,
 * recipientCategoryId) triple (note: always in sender/recipient order, never
 * "mine/theirs", since that would flip between the two clients and produce a
 * different interleave order — see quizEngine.ts) and get back the identical 10
 * questions in the identical order, with no question data ever sent over the wire.
 */
export function pickQuestions(matchId: string, senderCategoryId: string, recipientCategoryId: string): PickedQuestion[] {
  const catSender = QUIZ_CATEGORIES.find((c) => c.id === senderCategoryId)!;
  const catRecipient = QUIZ_CATEGORIES.find((c) => c.id === recipientCategoryId)!;
  const seed = hashSeed(matchId);

  if (senderCategoryId === recipientCategoryId) {
    const picked = seededShuffle(catSender.questions, mulberry32(seed)).slice(0, 10);
    return picked.map((question) => ({ categoryId: catSender.id, question }));
  }

  const pickedSender = seededShuffle(catSender.questions, mulberry32(seed)).slice(0, 5);
  const pickedRecipient = seededShuffle(catRecipient.questions, mulberry32(seed ^ 0x9e3779b9)).slice(0, 5);
  const interleaved: PickedQuestion[] = [];
  for (let i = 0; i < 5; i++) {
    interleaved.push({ categoryId: catSender.id, question: pickedSender[i] });
    interleaved.push({ categoryId: catRecipient.id, question: pickedRecipient[i] });
  }
  return interleaved;
}
