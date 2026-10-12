# 10xDevs Pomysły

## Aplikacja na siłownię

### Platforma i sposób rejestracji
- Aplikacja webowa (mobile-first UI — używana na telefonie na siłowni).
- Rejestracja treningu **w czasie rzeczywistym** (na gorąco, w trakcie/po każdej
  serii), nie retrospektywnie po powrocie z siłowni.
- Bez wsparcia offline w MVP — zakładamy stabilne połączenie online podczas
  treningu (brak service workera / synchronizacji offline).

### Główne problemy
- Trudno śledzić własną progresję (ciężary, powtórzenia, objętość) w czasie bez
  ręcznego prowadzenia notatek/arkusza.
- Po wyczerpaniu prostego planu treningowego trudno wiedzieć, co dalej — jak
  dobrać kolejny plan albo jak go zmodyfikować.
- (Do ustalenia) Czy problemem jest też brak motywacji/widoczności postępów, czy
  głównie brak narzędzia do planowania?

### Najmniejszy zestaw funkcjonalności
1. Kontrola dostępu — konta użytkowników z logowaniem (wymóg obowiązkowy do
   odznaki 10xBuilder).
2. Katalog ćwiczeń: predefiniowana lista podstawowych ćwiczeń + możliwość
   dodania własnego ćwiczenia przez użytkownika (różni ludzie różnie nazywają
   te same ćwiczenia) — fundament potrzebny, żeby rejestrowanie i progresja
   miały sens (ten sam "obiekt" ćwiczenia w czasie). Każde ćwiczenie ma
   przypisaną grupę mięśniową (potrzebne do reguł #3 i #4 poniżej).
3. Rejestrowanie treningów jako prowadzona "sesja treningowa":
   - "Rozpoczęcie treningu" przechodzi od razu do pierwszego ćwiczenia z planu.
   - Sekwencyjne przechodzenie między ćwiczeniami, z możliwością pominięcia
     ćwiczenia i powrotu do niego później w ramach tej samej sesji.
   - Rejestracja każdej serii (powtórzenia, obciążenie) w czasie rzeczywistym.
   - Odliczanie czasu przerwy między seriami (timer).
4. Wizualizacja progresji na podstawie zarejestrowanych treningów (np. wykres
   ciężaru/objętości w czasie dla danego ćwiczenia).
5. Rekomendacja — prosta reguła biznesowa (bez nadmiarowej złożoności, zgodnie
   z zasadą "mniejsze MVP"):
   - Progresja w ramach ćwiczenia: "jeśli użytkownik wykonał wszystkie serie
     z pełną liczbą powtórzeń w ostatnich N treningach, zwiększ obciążenie o X%".
   - Nowy plan treningowy: dopasowanie do jednego z predefiniowanych szablonów
     na podstawie celu/poziomu/częstotliwości (prosta reguła wyboru, nie AI).
6. Dodatkowe reguły biznesowe (rozszerzenie MVP, zaakceptowane):
   - **Wykrywanie rekordu (PR)**: przy zapisie serii licz szacowane 1RM (np.
     wzór Epleya z ciężaru i powtórzeń) i oznacz, jeśli to nowy rekord dla
     danego ćwiczenia.
   - **Powrót po przerwie**: jeśli od ostatniego treningu minęło więcej niż
     X dni, rekomendacja proponuje łatwiejszą, rozgrzewkową sesję zamiast
     kontynuacji progresji.
   - **Zastępowanie ćwiczenia**: jeśli użytkownik oznaczy ćwiczenie jako
     pominięte w trakcie sesji, system proponuje zamiennik z tej samej grupy
     mięśniowej z katalogu.
   - **Bilans objętości w tygodniu**: ostrzeżenie, jeśli jedna grupa
     mięśniowa jest trenowana wyraźnie częściej/rzadziej niż inne w ramach
     planu (agregacja liczby serii per grupa mięśniowa w oknie tygodnia).

### Co NIE wchodzi w zakres MVP
- Wczytywanie/import własnych planów treningowych z plików zewnętrznych
  (PDF, inne aplikacje) — ręczne wprowadzenie planu może wystarczyć na start.
- Współdzielenie planów między użytkownikami / funkcje społecznościowe.
- Personalizacja rekomendacji na podstawie dodatkowych zmiennych (sen, RPE,
  kalorie) — na start wystarczy prosta reguła progresji.
- Zaawansowana logika rekomendacji (np. wykrywanie plateau, wieloczynnikowy
  scoring, auto-regulacja) — zgodnie z wymogami zaliczenia nie oceniana jest
  złożoność aplikacji, więc prosta reguła jest wystarczająca; AI jako
  wzbogacenie rekomendacji to możliwa iteracja post-MVP, nie wymóg.

### Kryteria sukcesu
- Użytkownik może zarejestrować trening i zobaczyć go odzwierciedlony na
  wykresie progresji.
- System proponuje konkretną, uzasadnioną zmianę w kolejnym treningu (a nie
  tylko pokazuje historię).
- (Do ustalenia) Czy sukces mierzymy liczbą zarejestrowanych treningów, czy
  jakością/trafnością rekomendacji?