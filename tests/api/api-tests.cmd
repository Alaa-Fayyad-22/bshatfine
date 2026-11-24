@echo off
setlocal
chcp 65001 >nul

REM ==================================================================
REM  Bshatfine API test suite - DEVELOPMENT ONLY  (API on :5246)
REM  Covers: public API, auth, news (versions, delete), covers,
REM          workflow, entries, audit, users (incl. parallel race),
REM          lockout, rate limiting, CORS, security headers, database
REM  Uses ONLY the test accounts. Never touches the real Admin account.
REM ==================================================================
set "BASE=http://localhost:5246"
set "ADMIN_EMAIL=alaafayyadp1+admintest@gmail.com"
set "ADMIN_PASS=Test-Passphrase-2026-here"
set "EDITOR_EMAIL=alaafayyadp1+editortest@gmail.com"
set "EDITOR_PASS=Editor-Test-Pass-2026"
set "IMG="
set /a PASS=0, FAIL=0

set "WORK=%TEMP%\bsh-api-tests"
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
pushd "%WORK%"

echo Bshatfine API test suite - %DATE% %TIME%
echo Working folder: %WORK%

REM ---------- Test files ----------
if "%IMG%"=="" (
  curl -s -L -o test.jpg https://picsum.photos/800/600
  set "IMG=%WORK%\test.jpg"
)
if not exist "%WORK%\test.jpg" if not exist "%IMG%" (
  echo Could not get a test photo. Set IMG= at the top of the script to a JPG on your PC.
  goto :end
)
> fake.jpg echo hello
powershell -NoProfile -Command "$f=[IO.File]::Create('big.jpg'); $f.SetLength(12MB); $f.Close()"

set "RUN=%RANDOM%%RANDOM%"
set "TEMP_EMAIL=alaafayyadp1+suite%RUN%@gmail.com"
set "RACE_TAG=suite-race-%RUN%"
set "RACE_EMAIL=%RACE_TAG%@example.test"
set "A50=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
set "LONG=%A50%%A50%%A50%%A50%A"

> login-admin.json      echo {"email":"%ADMIN_EMAIL%","password":"%ADMIN_PASS%"}
> login-editor.json     echo {"email":"%EDITOR_EMAIL%","password":"%EDITOR_PASS%"}
> login-editor-bad.json echo {"email":"%EDITOR_EMAIL%","password":"Wrong-Password-2026"}
> login-unknown.json    echo {"email":"nobody-suite@example.com","password":"Wrong-Password-2026"}
> code.json             echo {"code":"000000"}
> pw-anon.json          echo {"currentPassword":"Anything-2026x","newPassword":"Anything-Else-2026"}

> news-ok.json          echo {"translations":[{"language":"ar","title":"Suite AR title","body":"Suite AR body"},{"language":"en","title":"Suite test article","body":"Suite EN body"}]}
> news-en-only.json     echo {"translations":[{"language":"en","title":"Suite English only","body":"Suite EN body"}]}
> news-empty.json       echo {"translations":[]}
> news-missing.json     echo {}
> news-null.json        echo {"translations":[null]}
> news-fr.json          echo {"translations":[{"language":"fr","title":"Titre","body":"Texte"}]}
> news-dup.json         echo {"translations":[{"language":"ar","title":"One","body":"One"},{"language":"AR","title":"Two","body":"Two"}]}
> news-long.json        echo {"translations":[{"language":"ar","title":"%LONG%","body":"x"}]}
> news-emptytitle.json  echo {"translations":[{"language":"ar","title":"","body":"x"}]}
> news-nul.json         echo {"translations":[{"language":"ar","title":"a\u0000b","body":"x"}]}
> entry-nul.json        echo {"kind":"place","translations":[{"language":"ar","title":"a\u0000b","summary":"x"}],"category":"nature"}

> entry-ok.json         echo {"kind":"project","translations":[{"language":"ar","title":"Suite AR project","summary":"Suite AR summary"},{"language":"en","title":"Suite test project","summary":"Suite EN summary","body":"Suite body"}],"category":"roads","status":"planned","year":2026}
> entry-badkind.json    echo {"kind":"castle","translations":[{"language":"ar","title":"x","summary":"x"}]}
> entry-badcat.json     echo {"kind":"project","translations":[{"language":"ar","title":"x","summary":"x"}],"category":"heritage","status":"planned","year":2026}
> entry-badyear.json    echo {"kind":"project","translations":[{"language":"ar","title":"x","summary":"x"}],"category":"roads","status":"planned","year":3000}
> entry-history-cat.json echo {"kind":"history","translations":[{"language":"ar","title":"x","summary":"x"}],"category":"roads","year":1950}

> ev-ok.json          echo {"translations":[{"language":"ar","title":"Suite AR event","summary":"Suite AR summary","location":"Suite square","organizer":"Suite organizer"},{"language":"en","title":"Suite test event","summary":"Suite EN summary","body":"Suite body"}],"category":"cultural","startsAt":"2030-06-01T18:00:00+03:00","endsAt":"2030-06-01T21:00:00+03:00","isAllDay":false,"mapUrl":"https://maps.example.com/suite"}
> ev-nostart.json     echo {"translations":[{"language":"ar","title":"x","summary":"x"}],"category":"cultural","isAllDay":false}
> ev-badcat.json      echo {"translations":[{"language":"ar","title":"x","summary":"x"}],"category":"party","startsAt":"2030-06-01T18:00:00+03:00","isAllDay":false}
> ev-endbefore.json   echo {"translations":[{"language":"ar","title":"x","summary":"x"}],"category":"cultural","startsAt":"2030-06-01T18:00:00+03:00","endsAt":"2030-06-01T17:00:00+03:00","isAllDay":false}
> ev-httpmap.json     echo {"translations":[{"language":"ar","title":"x","summary":"x"}],"category":"cultural","startsAt":"2030-06-01T18:00:00+03:00","isAllDay":false,"mapUrl":"http://maps.example.com/x"}
> ev-quotemap.json    echo {"translations":[{"language":"ar","title":"x","summary":"x"}],"category":"cultural","startsAt":"2030-06-01T18:00:00+03:00","isAllDay":false,"mapUrl":"https://maps.example.com/x'onmouseover=alert(1)"}
> ev-nul.json         echo {"translations":[{"language":"ar","title":"a\u0000b","summary":"x"}],"category":"cultural","startsAt":"2030-06-01T18:00:00+03:00","isAllDay":false}
> ev-past.json        echo {"translations":[{"language":"ar","title":"Suite AR past event","summary":"Suite AR summary"}],"category":"other","startsAt":"2020-05-01T00:00:00+03:00","isAllDay":true}

> nt-ok.json          echo {"translations":[{"language":"ar","title":"Suite AR notice","body":"Suite AR body","area":"Suite area"},{"language":"en","title":"Suite test notice","body":"Suite EN body"}],"category":"water","priority":"urgent","validFrom":"2030-06-01T08:00:00+03:00","validUntil":"2030-06-01T14:00:00+03:00"}
> nt-badcat.json      echo {"translations":[{"language":"ar","title":"x"}],"category":"party","priority":"normal"}
> nt-badprio.json     echo {"translations":[{"language":"ar","title":"x"}],"category":"water","priority":"panic"}
> nt-endbefore.json   echo {"translations":[{"language":"ar","title":"x"}],"category":"water","validFrom":"2030-06-01T14:00:00+03:00","validUntil":"2030-06-01T08:00:00+03:00"}
> nt-notitle.json     echo {"translations":[{"language":"ar","title":""}],"category":"water"}
> nt-nul.json         echo {"translations":[{"language":"ar","title":"a\u0000b"}],"category":"water"}
> nt-past.json        echo {"translations":[{"language":"ar","title":"Suite AR expired notice"}],"category":"roads","priority":"normal","validFrom":"2020-05-01T08:00:00+03:00","validUntil":"2020-05-01T14:00:00+03:00"}

> user-create.json      echo {"email":"%TEMP_EMAIL%","displayName":"Suite Temp User","role":"Editor"}
> user-badrole.json     echo {"email":"suite-badrole@example.com","displayName":"Bad Role","role":"SuperAdmin"}
> user-dup.json         echo {"email":"%EDITOR_EMAIL%","displayName":"Duplicate","role":"Editor"}
> user-noname.json      echo {"email":"suite-noname@example.com","displayName":"","role":"Editor"}
> user-self-demote.json echo {"displayName":"Administrator","role":"Editor"}
> user-promote.json     echo {"displayName":"Suite Temp User","role":"Admin"}
> user-demote.json      echo {"displayName":"Suite Temp User","role":"Editor"}
> user-race.json        echo {"email":"%RACE_EMAIL%","displayName":"Suite Race User","role":"Editor"}

call :countfiles
set "FILES_BEFORE=%FILES%"

REM ==================================================================
echo.
echo === 1. PUBLIC API - no login ===
call :http 200 "Public news list - Arabic" GET "/api/news?lang=ar" - -
call :check ".page" "1" "Public news list - starts at page 1"
call :http 200 "Public news list - English" GET "/api/news?lang=en" - -
call :http 200 "Public news list - language code is case-insensitive" GET "/api/news?lang=AR" - -
call :http 400 "Public news list - unsupported language fr" GET "/api/news?lang=fr" - -
call :http 400 "Public news list - numeric language code refused" GET "/api/news?lang=1" - -
call :http 200 "Public news list - page 0" GET "/api/news?lang=ar&page=0" - -
call :check ".page" "1" "Public news list - page 0 becomes page 1"
call :http 200 "Public news list - huge pageSize" GET "/api/news?lang=ar&pageSize=1000" - -
call :check ".pageSize" "50" "Public news list - pageSize capped at 50"
call :http 404 "Public article - unknown slug" GET "/api/news/this-slug-does-not-exist?lang=ar" - -
call :http 404 "Public article - SQL injection attempt in slug" GET "/api/news/x'OR'1'='1?lang=ar" - -
call :http 200 "Public entries - projects" GET "/api/entries?kind=project&lang=ar" - -
call :http 400 "Public entries - unknown kind" GET "/api/entries?kind=castle&lang=ar" - -
call :http 404 "Public entry - unknown id" GET "/api/entries/00000000-0000-0000-0000-000000000000?lang=ar" - -
call :http 404 "Public file - unknown id" GET "/api/files/00000000-0000-0000-0000-000000000000" - -
call :http 401 "Public file - invalid id format matches nothing, deny by default" GET "/api/files/not-a-guid" - -

REM ==================================================================
call :wait 61
echo.
echo === 2. AUTHENTICATION ===
call :http 401 "Me - not logged in" GET "/api/auth/me" - -
call :http 200 "Login - test Admin" POST "/api/auth/login" admin.txt login-admin.json
if not "%CODE%"=="200" (
  echo.
  echo   STOPPED: the test Admin could not log in, so every later test would fail for the same reason.
  echo   429 = the login rate limit is still used up: restart the API, wait one minute, run again.
  echo   401 = wrong test password, or the test Admin is disabled or locked.
  goto :end
)
call :check ".requiresTwoFactor" "False" "Login - no 2FA step"
call :header "httponly" 1 "Session cookie - HttpOnly"
call :header "samesite=strict" 1 "Session cookie - SameSite=Strict"
call :header "secure" 1 "Session cookie - Secure"
call :http 200 "Me - logged in" GET "/api/auth/me" admin.txt -
call :check ".roles -join ','" "Admin" "Me - role is Admin"
call :check ".mustChangePassword" "False" "Me - no password change required"
call :json ".id"
set "ADMIN_ID=%VAL%"
call :http 401 "Login - unknown email" POST "/api/auth/login" - login-unknown.json
call :check ".detail" "Invalid email or password." "Login - unknown email gets the generic message"
call :http 401 "Login - wrong password" POST "/api/auth/login" - login-editor-bad.json
call :check ".detail" "Invalid email or password." "Login - wrong password gets the SAME message"
call :http 200 "Login - test Editor" POST "/api/auth/login" editor.txt login-editor.json
call :http 401 "2FA code without the password step" POST "/api/auth/login/2fa" - code.json
call :http 401 "Recovery code without the password step" POST "/api/auth/login/recovery" - code.json
call :http 401 "2FA setup - not logged in" GET "/api/auth/2fa/setup" - -
call :http 401 "2FA enable - not logged in" POST "/api/auth/2fa/enable" - code.json
call :http 400 "2FA enable - wrong code" POST "/api/auth/2fa/enable" admin.txt code.json
call :http 401 "Change password - not logged in" POST "/api/auth/change-password" - pw-anon.json
call :http 204 "Logout - without a session is harmless" POST "/api/auth/logout" - -
call :http 200 "Login - second Admin session" POST "/api/auth/login" admin2.txt login-admin.json
copy /y admin2.txt admin2-copy.txt >nul
call :http 204 "Logout - second session" POST "/api/auth/logout" admin2.txt -
call :http 401 "Me - after logout" GET "/api/auth/me" admin2.txt -
call :http 401 "Logout - a saved copy of the old cookie no longer works" GET "/api/auth/me" admin2-copy.txt -
call :http 401 "Logout - the old cookie cannot reach admin data" GET "/api/admin/news" admin2-copy.txt -
call :http 200 "Logout - the other session stays logged in" GET "/api/auth/me" admin.txt -
call :http 404 "Register - switched off, looks like it does not exist" POST "/api/auth/register" - login-unknown.json
call :http 401 "Deny by default - unknown admin route, anonymous" GET "/api/admin/does-not-exist" - -
call :http 404 "Deny by default - unknown admin route, logged in" GET "/api/admin/does-not-exist" admin.txt -

REM ==================================================================
echo.
echo === 3. ADMIN - NEWS ===
call :http 401 "Admin news list - not logged in" GET "/api/admin/news" - -
call :http 200 "Admin news list - Editor" GET "/api/admin/news" editor.txt -
call :http 200 "Admin news list - Admin, pageSize 1" GET "/api/admin/news?pageSize=1" admin.txt -
call :check ".items.Count" "1" "Admin news list - returns 1 item"
call :http 200 "Admin news list - status filter Draft" GET "/api/admin/news?status=Draft" admin.txt -
call :http 401 "Create news - not logged in" POST "/api/admin/news" - news-ok.json
call :http 201 "Create news - Arabic and English" POST "/api/admin/news" admin.txt news-ok.json
call :json ".id"
set "NEWS_ID=%VAL%"
set "NEWS_COVER=/api/admin/news/%NEWS_ID%/cover"
call :check ".status" "Draft" "Create news - starts as a Draft"
call :check ".updatedAt" "null" "Create news - updatedAt is empty"
call :check ".slug.StartsWith('suite-test-article-')" "True" "Create news - English slug generated"
call :check ".translations[0].language" "ar" "Create news - Arabic listed first"
call :http 200 "Get news by id" GET "/api/admin/news/%NEWS_ID%" admin.txt -
call :http 404 "Get news - unknown id" GET "/api/admin/news/00000000-0000-0000-0000-000000000000" admin.txt -
call :http 404 "Get news - invalid id format" GET "/api/admin/news/not-a-guid" admin.txt -
call :http 400 "Create news - empty translations" POST "/api/admin/news" admin.txt news-empty.json
call :http 400 "Create news - missing translations field" POST "/api/admin/news" admin.txt news-missing.json
call :http 400 "Create news - null translation entry" POST "/api/admin/news" admin.txt news-null.json
call :http 400 "Create news - unsupported language" POST "/api/admin/news" admin.txt news-fr.json
call :http 400 "Create news - duplicate language ar and AR" POST "/api/admin/news" admin.txt news-dup.json
call :http 400 "Create news - title over 200 characters" POST "/api/admin/news" admin.txt news-long.json
call :http 400 "Create news - empty title" POST "/api/admin/news" admin.txt news-emptytitle.json
call :http 400 "Create news - NUL character refused, not a 500" POST "/api/admin/news" admin.txt news-nul.json
call :http 201 "Create news - English-only draft" POST "/api/admin/news" admin.txt news-en-only.json
call :json ".id"
set "EN_ID=%VAL%"
call :json ".slug"
set "EN_SLUG=%VAL%"
call :http 404 "Public article - drafts are hidden" GET "/api/news/%EN_SLUG%?lang=en" - -
call :http 400 "Publish - English-only is refused" POST "/api/admin/news/%EN_ID%/publish" admin.txt -
call :http 400 "Republish - a draft is refused" POST "/api/admin/news/%NEWS_ID%/republish" admin.txt -

call :getver "/api/admin/news/%NEWS_ID%" admin.txt
set "OLDVER=%VER%"
> news-update.json echo {"translations":[{"language":"ar","title":"Suite AR title 2","body":"Suite AR body 2"},{"language":"en","title":"Suite test article edited","body":"Suite EN body 2"}],"version":%VER%}
call :http 200 "Update news - edit both languages" PUT "/api/admin/news/%NEWS_ID%" admin.txt news-update.json
call :check ".slug.StartsWith('suite-test-article-edited-')" "True" "Update news - draft slug follows the English title"
call :json ".slug"
set "SLUG=%VAL%"
call :http 409 "Update news - stale version refused, someone else saved first" PUT "/api/admin/news/%NEWS_ID%" admin.txt news-update.json

call :getver "/api/admin/news/%NEWS_ID%" admin.txt
> news-noar.json echo {"translations":[{"language":"en","title":"Suite English only","body":"Suite EN body"}],"version":%VER%}
call :http 400 "Update news - removing Arabic is refused" PUT "/api/admin/news/%NEWS_ID%" admin.txt news-noar.json

call :http 200 "Publish" POST "/api/admin/news/%NEWS_ID%/publish" admin.txt -
call :check ".status" "Published" "Publish - status is Published"
call :json ".publishedAt"
set "PUBLISHED_AT=%VAL%"
call :http 400 "Publish - twice is refused" POST "/api/admin/news/%NEWS_ID%/publish" admin.txt -
call :getver "/api/admin/news/%NEWS_ID%" admin.txt
> news-after.json echo {"translations":[{"language":"ar","title":"Suite AR title","body":"Suite AR body"},{"language":"en","title":"Suite test article","body":"Suite EN body"}],"version":%VER%}
call :http 200 "Update news - change the title after publishing" PUT "/api/admin/news/%NEWS_ID%" admin.txt news-after.json
call :check ".slug" "%SLUG%" "Update news - slug frozen after publishing"
call :http 200 "Public article - visible by slug, English" GET "/api/news/%SLUG%?lang=en" - -
call :check ".language" "en" "Public article - English text returned"
call :http 200 "Public article - visible by slug, Arabic" GET "/api/news/%SLUG%?lang=ar" - -
call :check ".language" "ar" "Public article - Arabic text returned"

call :http 400 "Delete news - a published article is refused" DELETE "/api/admin/news/%NEWS_ID%" admin.txt -
call :http 204 "Delete news - a draft" DELETE "/api/admin/news/%EN_ID%" admin.txt -
call :http 404 "Delete news - deleted draft is gone" GET "/api/admin/news/%EN_ID%" admin.txt -
call :http 404 "Delete news - twice gives 404" DELETE "/api/admin/news/%EN_ID%" admin.txt -

REM ==================================================================
echo.
echo === 4. COVER IMAGES ===
call :upload 401 "Cover upload - not logged in" none.txt file "%IMG%" "%NEWS_COVER%"
call :upload 200 "Cover upload - real photo" admin.txt file "%IMG%" "%NEWS_COVER%"
call :json ".coverImageUrl"
set "COVER1=%VAL%"
call :check ".coverImageUrl.StartsWith('/api/files/')" "True" "Cover upload - URL points to the file endpoint"
call :http 200 "Cover file - public download" GET "%COVER1%" - -
call :header "image/webp" 1 "Cover file - converted to WebP"
call :header "immutable" 1 "Cover file - cached as immutable"
call :header "CDN-Cache-Control: public, max-age=3600" 1 "Cover file - shared caches keep it at most 1 hour"
call :header "nosniff" 1 "Cover file - nosniff header"
call :header "X-Frame-Options: DENY" 1 "Cover file - security headers present"
call :upload 200 "Cover upload - replace" admin.txt file "%IMG%" "%NEWS_COVER%"
call :http 404 "Cover file - old photo deleted after replace" GET "%COVER1%" - -
call :upload 400 "Cover upload - fake image" admin.txt file fake.jpg "%NEWS_COVER%"
call :upload 413 "Cover upload - 12 MB file refused" admin.txt file big.jpg "%NEWS_COVER%" 400
call :upload 400 "Cover upload - wrong form field name" admin.txt other "%IMG%" "%NEWS_COVER%"
call :upload 200 "Cover upload - Editor is allowed" editor.txt file "%IMG%" "%NEWS_COVER%"
call :json ".coverImageUrl"
set "COVER3=%VAL%"
call :http 200 "Cover remove" DELETE "%NEWS_COVER%" admin.txt -
call :check ".coverImageUrl" "null" "Cover remove - article has no cover"
call :http 404 "Cover file - removed photo deleted" GET "%COVER3%" - -

REM ==================================================================
echo.
echo === 5. STATUS WORKFLOW ===
call :http 200 "Archive" POST "/api/admin/news/%NEWS_ID%/archive" admin.txt -
call :http 400 "Archive - twice is refused" POST "/api/admin/news/%NEWS_ID%/archive" admin.txt -
call :getver "/api/admin/news/%NEWS_ID%" admin.txt
> news-archived.json echo {"translations":[{"language":"ar","title":"Suite AR title","body":"Suite AR body"},{"language":"en","title":"Suite test article","body":"Suite EN body"}],"version":%VER%}
call :http 400 "Edit archived news is refused" PUT "/api/admin/news/%NEWS_ID%" admin.txt news-archived.json
call :upload 400 "Cover upload - archived news is refused" admin.txt file "%IMG%" "%NEWS_COVER%"
call :http 404 "Public - archived article hidden" GET "/api/news/%SLUG%?lang=en" - -
call :http 400 "Delete news - archived is refused, only drafts" DELETE "/api/admin/news/%NEWS_ID%" admin.txt -
call :http 200 "Republish" POST "/api/admin/news/%NEWS_ID%/republish" admin.txt -
call :check ".publishedAt" "%PUBLISHED_AT%" "Republish - original publish date kept"
call :check ".slug" "%SLUG%" "Republish - slug kept"
call :http 200 "Public - republished article visible again" GET "/api/news/%SLUG%?lang=en" - -
call :http 400 "Republish - twice is refused" POST "/api/admin/news/%NEWS_ID%/republish" admin.txt -

REM ==================================================================
echo.
echo === 6. ENTRIES - history, projects, places, services ===
call :http 401 "Admin entries - not logged in" GET "/api/admin/entries?kind=project" - -
call :http 200 "Admin entries - Editor" GET "/api/admin/entries?kind=project" editor.txt -
call :http 401 "Create entry - not logged in" POST "/api/admin/entries" - entry-ok.json
call :http 400 "Create entry - unknown kind" POST "/api/admin/entries" admin.txt entry-badkind.json
call :http 400 "Create entry - category of another kind" POST "/api/admin/entries" admin.txt entry-badcat.json
call :http 400 "Create entry - year out of range" POST "/api/admin/entries" admin.txt entry-badyear.json
call :http 400 "Create entry - history has no category" POST "/api/admin/entries" admin.txt entry-history-cat.json
call :http 400 "Create entry - NUL character refused, not a 500" POST "/api/admin/entries" admin.txt entry-nul.json
call :http 201 "Create entry - project" POST "/api/admin/entries" admin.txt entry-ok.json
call :json ".id"
set "ENTRY_ID=%VAL%"
set "ENTRY_COVER=/api/admin/entries/%ENTRY_ID%/cover"
call :http 404 "Public entry - unpublished is hidden" GET "/api/entries/%ENTRY_ID%?lang=en" - -

call :getver "/api/admin/entries/%ENTRY_ID%" admin.txt
> entry-update.json echo {"translations":[{"language":"ar","title":"Suite AR project 2","summary":"Suite AR summary 2"},{"language":"en","title":"Suite test project edited","summary":"Suite EN summary 2"}],"category":"water","status":"ongoing","year":2026,"version":%VER%}
call :http 200 "Update entry" PUT "/api/admin/entries/%ENTRY_ID%" admin.txt entry-update.json
call :check ".category" "water" "Update entry - category changed"
call :http 409 "Update entry - stale version refused" PUT "/api/admin/entries/%ENTRY_ID%" admin.txt entry-update.json

call :http 200 "Publish entry" POST "/api/admin/entries/%ENTRY_ID%/publish" admin.txt -
call :http 200 "Public entry - published is visible" GET "/api/entries/%ENTRY_ID%?lang=en" - -

call :upload 200 "Entry cover upload" admin.txt file "%IMG%" "%ENTRY_COVER%"
call :json ".coverImageUrl"
set "ECOVER=%VAL%"
call :http 200 "Entry cover file - public download" GET "%ECOVER%" - -
call :header "image/webp" 1 "Entry cover file - converted to WebP"
call :upload 400 "Entry cover upload - fake image" admin.txt file fake.jpg "%ENTRY_COVER%"

call :http 400 "Delete entry - published is refused" DELETE "/api/admin/entries/%ENTRY_ID%" admin.txt -
call :http 200 "Unpublish entry" POST "/api/admin/entries/%ENTRY_ID%/unpublish" admin.txt -
call :http 404 "Public entry - hidden after unpublish" GET "/api/entries/%ENTRY_ID%?lang=en" - -
call :http 204 "Delete entry" DELETE "/api/admin/entries/%ENTRY_ID%" admin.txt -
call :http 404 "Delete entry - it is gone" GET "/api/admin/entries/%ENTRY_ID%" admin.txt -
call :http 404 "Delete entry - its cover photo is gone too" GET "%ECOVER%" - -

call :http 403 "Council admin - Editor is refused" GET "/api/admin/council" editor.txt -
call :http 403 "Site settings admin - Editor is refused" GET "/api/admin/site-settings" editor.txt -

echo.
echo --- Contact details validation (invalid values only: nothing is saved) ---
call :getver "/api/admin/site-settings" admin.txt
> ss-quote.json    echo {"mapUrl":"https://maps.example.com/a\"onmouseover=alert(1)","version":%VER%}
> ss-space.json    echo {"mapUrl":"https://maps.example.com/a b","version":%VER%}
> ss-userinfo.json echo {"facebookUrl":"https://user:pass@evil.example/page","version":%VER%}
> ss-nodot.json    echo {"instagramUrl":"https://localhost/page","version":%VER%}
> ss-http.json     echo {"mapUrl":"http://maps.example.com/x","version":%VER%}
> ss-email1.json   echo {"email":"\"script\"@example.test","version":%VER%}
> ss-email2.json   echo {"email":"info@localhost","version":%VER%}
call :http 400 "Contact - link with a quote refused" PUT "/api/admin/site-settings" admin.txt ss-quote.json
call :check ".detail" "The map link must be a complete https:// address." "Contact - quote refused by the link rule"
call :http 400 "Contact - link with a space refused" PUT "/api/admin/site-settings" admin.txt ss-space.json
call :http 400 "Contact - link with user:password refused" PUT "/api/admin/site-settings" admin.txt ss-userinfo.json
call :http 400 "Contact - link without a real host refused" PUT "/api/admin/site-settings" admin.txt ss-nodot.json
call :http 400 "Contact - http link refused" PUT "/api/admin/site-settings" admin.txt ss-http.json
call :http 400 "Contact - quoted email refused" PUT "/api/admin/site-settings" admin.txt ss-email1.json
call :check ".detail" "The email address is not valid." "Contact - quoted email refused by the email rule"
call :http 400 "Contact - email without a real domain refused" PUT "/api/admin/site-settings" admin.txt ss-email2.json

REM ==================================================================
call :wait 61
echo.
echo === 6b. EVENTS ===
call :http 200 "Public events - upcoming" GET "/api/events/upcoming?lang=ar" - -
call :http 200 "Public events - past" GET "/api/events/past?lang=ar" - -
call :check ".page" "1" "Public events - past starts at page 1"
call :http 400 "Public events - unsupported language" GET "/api/events/upcoming?lang=fr" - -
call :http 404 "Public event - unknown id" GET "/api/events/00000000-0000-0000-0000-000000000000?lang=ar" - -
call :http 401 "Admin events - not logged in" GET "/api/admin/events" - -
call :http 200 "Admin events - Editor" GET "/api/admin/events" editor.txt -
call :http 401 "Create event - not logged in" POST "/api/admin/events" - ev-ok.json
call :http 400 "Create event - start is required" POST "/api/admin/events" admin.txt ev-nostart.json
call :http 400 "Create event - unknown category" POST "/api/admin/events" admin.txt ev-badcat.json
call :http 400 "Create event - end before start" POST "/api/admin/events" admin.txt ev-endbefore.json
call :http 400 "Create event - map link must be https" POST "/api/admin/events" admin.txt ev-httpmap.json
call :http 400 "Create event - map link with a quote refused" POST "/api/admin/events" admin.txt ev-quotemap.json
call :http 400 "Create event - NUL character refused, not a 500" POST "/api/admin/events" admin.txt ev-nul.json
call :http 201 "Create event - upcoming" POST "/api/admin/events" admin.txt ev-ok.json
call :json ".id"
set "EV_ID=%VAL%"
set "EV_COVER=/api/admin/events/%EV_ID%/cover"
call :check ".category" "cultural" "Create event - category saved"
call :check ".isPublished" "False" "Create event - starts unpublished"
call :check ".translations[0].language" "ar" "Create event - Arabic listed first"
call :http 404 "Public event - unpublished is hidden" GET "/api/events/%EV_ID%?lang=en" - -

call :getver "/api/admin/events/%EV_ID%" admin.txt
> ev-update.json echo {"translations":[{"language":"ar","title":"Suite AR event 2","summary":"Suite AR summary 2","location":"Suite square"},{"language":"en","title":"Suite test event edited","summary":"Suite EN summary 2"}],"category":"sports","startsAt":"2030-06-01T18:00:00+03:00","endsAt":"2030-06-01T21:00:00+03:00","isAllDay":false,"mapUrl":"https://maps.example.com/suite","version":%VER%}
call :http 200 "Update event" PUT "/api/admin/events/%EV_ID%" admin.txt ev-update.json
call :check ".category" "sports" "Update event - category changed"
call :http 409 "Update event - stale version refused" PUT "/api/admin/events/%EV_ID%" admin.txt ev-update.json

call :http 200 "Publish event" POST "/api/admin/events/%EV_ID%/publish" admin.txt -
call :http 400 "Publish event - twice is refused" POST "/api/admin/events/%EV_ID%/publish" admin.txt -
call :http 200 "Public event - published is visible" GET "/api/events/%EV_ID%?lang=en" - -
call :check ".title" "Suite test event edited" "Public event - English text returned"
call :check ".isPast" "False" "Public event - not past"
call :http 200 "Public events - upcoming list" GET "/api/events/upcoming?lang=ar&limit=50" - -
call :check ".id -contains '%EV_ID%'" "True" "Public events - upcoming list contains it"

call :upload 200 "Event cover upload" admin.txt file "%IMG%" "%EV_COVER%"
call :json ".coverImageUrl"
set "EVCOVER=%VAL%"
call :http 200 "Event cover file - public download" GET "%EVCOVER%" - -
call :header "image/webp" 1 "Event cover file - converted to WebP"
call :upload 400 "Event cover upload - fake image" admin.txt file fake.jpg "%EV_COVER%"

call :http 201 "Create event - in the past, all day" POST "/api/admin/events" admin.txt ev-past.json
call :json ".id"
set "PAST_ID=%VAL%"
call :http 200 "Publish the past event" POST "/api/admin/events/%PAST_ID%/publish" admin.txt -
call :http 200 "Public event - past event" GET "/api/events/%PAST_ID%?lang=ar" - -
call :check ".isPast" "True" "Public event - marked as past"
call :http 200 "Public events - archive" GET "/api/events/past?lang=ar&pageSize=50" - -
call :check ".items.id -contains '%PAST_ID%'" "True" "Public events - archive contains the past event"
call :http 200 "Public events - upcoming again" GET "/api/events/upcoming?lang=ar&limit=50" - -
call :check ".id -contains '%PAST_ID%'" "False" "Public events - past event not in upcoming"

call :http 400 "Delete event - published is refused" DELETE "/api/admin/events/%EV_ID%" admin.txt -
call :http 200 "Unpublish event" POST "/api/admin/events/%EV_ID%/unpublish" admin.txt -
call :http 404 "Public event - hidden after unpublish" GET "/api/events/%EV_ID%?lang=en" - -
call :http 204 "Delete event" DELETE "/api/admin/events/%EV_ID%" admin.txt -
call :http 404 "Delete event - it is gone" GET "/api/admin/events/%EV_ID%" admin.txt -
call :http 404 "Delete event - its cover photo is gone too" GET "%EVCOVER%" - -
call :http 200 "Cleanup - unpublish the past event" POST "/api/admin/events/%PAST_ID%/unpublish" admin.txt -
call :http 204 "Cleanup - delete the past event" DELETE "/api/admin/events/%PAST_ID%" admin.txt -
call :http 200 "Audit filter - event deleted" GET "/api/admin/audit?action=event.deleted" admin.txt -
call :check ".totalCount -ge 2" "True" "Audit - event deletions recorded"

REM ==================================================================
call :wait 61
echo.
echo === 6c. NOTICES ===
call :http 200 "Public notices - active" GET "/api/notices?lang=ar" - -
call :http 200 "Public notices - urgent" GET "/api/notices/urgent?lang=ar" - -
call :http 200 "Public notices - archive" GET "/api/notices/archive?lang=ar" - -
call :check ".page" "1" "Public notices - archive starts at page 1"
call :http 400 "Public notices - unknown category filter" GET "/api/notices?lang=ar&category=party" - -
call :http 400 "Public notices - unsupported language" GET "/api/notices?lang=fr" - -
call :http 404 "Public notice - unknown id" GET "/api/notices/00000000-0000-0000-0000-000000000000?lang=ar" - -
call :http 401 "Admin notices - not logged in" GET "/api/admin/notices" - -
call :http 200 "Admin notices - Editor" GET "/api/admin/notices" editor.txt -
call :http 401 "Create notice - not logged in" POST "/api/admin/notices" - nt-ok.json
call :http 400 "Create notice - unknown category" POST "/api/admin/notices" admin.txt nt-badcat.json
call :http 400 "Create notice - unknown priority" POST "/api/admin/notices" admin.txt nt-badprio.json
call :http 400 "Create notice - end before start" POST "/api/admin/notices" admin.txt nt-endbefore.json
call :http 400 "Create notice - empty title" POST "/api/admin/notices" admin.txt nt-notitle.json
call :http 400 "Create notice - NUL character refused, not a 500" POST "/api/admin/notices" admin.txt nt-nul.json
call :http 201 "Create notice - urgent, still valid" POST "/api/admin/notices" admin.txt nt-ok.json
call :json ".id"
set "NT_ID=%VAL%"
call :check ".priority" "urgent" "Create notice - priority saved"
call :check ".isPublished" "False" "Create notice - starts unpublished"
call :check ".translations[0].language" "ar" "Create notice - Arabic listed first"
call :http 404 "Public notice - unpublished is hidden" GET "/api/notices/%NT_ID%?lang=en" - -

call :getver "/api/admin/notices/%NT_ID%" admin.txt
> nt-update.json echo {"translations":[{"language":"ar","title":"Suite AR notice 2","area":"Suite area"},{"language":"en","title":"Suite test notice edited"}],"category":"roads","priority":"urgent","validFrom":"2030-06-01T08:00:00+03:00","validUntil":"2030-06-01T14:00:00+03:00","version":%VER%}
call :http 200 "Update notice" PUT "/api/admin/notices/%NT_ID%" admin.txt nt-update.json
call :check ".category" "roads" "Update notice - category changed"
call :http 409 "Update notice - stale version refused" PUT "/api/admin/notices/%NT_ID%" admin.txt nt-update.json

call :http 200 "Publish notice" POST "/api/admin/notices/%NT_ID%/publish" admin.txt -
call :http 400 "Publish notice - twice is refused" POST "/api/admin/notices/%NT_ID%/publish" admin.txt -
call :http 200 "Public notice - published is visible" GET "/api/notices/%NT_ID%?lang=en" - -
call :check ".title" "Suite test notice edited" "Public notice - English text returned"
call :check ".isExpired" "False" "Public notice - not expired"
call :http 200 "Public notices - active list" GET "/api/notices?lang=ar&limit=50" - -
call :check ".id -contains '%NT_ID%'" "True" "Public notices - active list contains it"
call :http 200 "Public notices - urgent banner list" GET "/api/notices/urgent?lang=ar" - -
call :check ".id -contains '%NT_ID%'" "True" "Public notices - urgent banner contains it"
call :http 200 "Public notices - filter by its category" GET "/api/notices?lang=ar&category=roads&limit=50" - -
call :check ".id -contains '%NT_ID%'" "True" "Public notices - category filter finds it"
call :http 200 "Public notices - filter by another category" GET "/api/notices?lang=ar&category=health&limit=50" - -
call :check ".id -contains '%NT_ID%'" "False" "Public notices - other category does not show it"

call :http 201 "Create notice - already expired" POST "/api/admin/notices" admin.txt nt-past.json
call :json ".id"
set "NT_PAST=%VAL%"
call :http 200 "Publish the expired notice" POST "/api/admin/notices/%NT_PAST%/publish" admin.txt -
call :http 200 "Public notice - expired one is still readable" GET "/api/notices/%NT_PAST%?lang=ar" - -
call :check ".isExpired" "True" "Public notice - marked as expired"
call :http 200 "Public notices - archive again" GET "/api/notices/archive?lang=ar&pageSize=50" - -
call :check ".items.id -contains '%NT_PAST%'" "True" "Public notices - archive contains the expired notice"
call :http 200 "Public notices - active again" GET "/api/notices?lang=ar&limit=50" - -
call :check ".id -contains '%NT_PAST%'" "False" "Public notices - expired notice not in the active list"

call :http 400 "Delete notice - published is refused" DELETE "/api/admin/notices/%NT_ID%" admin.txt -
call :http 200 "Unpublish notice" POST "/api/admin/notices/%NT_ID%/unpublish" admin.txt -
call :http 404 "Public notice - hidden after unpublish" GET "/api/notices/%NT_ID%?lang=en" - -
call :http 200 "Public notices - urgent banner after unpublish" GET "/api/notices/urgent?lang=ar" - -
call :check ".id -contains '%NT_ID%'" "False" "Public notices - banner no longer shows it"
call :http 204 "Delete notice" DELETE "/api/admin/notices/%NT_ID%" admin.txt -
call :http 404 "Delete notice - it is gone" GET "/api/admin/notices/%NT_ID%" admin.txt -
call :http 200 "Cleanup - unpublish the expired notice" POST "/api/admin/notices/%NT_PAST%/unpublish" admin.txt -
call :http 204 "Cleanup - delete the expired notice" DELETE "/api/admin/notices/%NT_PAST%" admin.txt -
call :http 200 "Audit filter - notice deleted" GET "/api/admin/audit?action=notice.deleted" admin.txt -
call :check ".totalCount -ge 2" "True" "Audit - notice deletions recorded"

REM ==================================================================
echo.
echo === 7. AUDIT LOG ===
call :http 401 "Audit - not logged in" GET "/api/admin/audit" - -
call :http 403 "Audit - Editor is refused" GET "/api/admin/audit" editor.txt -
call :http 200 "Audit - Admin, last 100 entries" GET "/api/admin/audit?pageSize=100" admin.txt -
call :nosecret "Audit - contains no passwords"
call :http 200 "Audit filter - failed logins" GET "/api/admin/audit?action=auth.login.failed" admin.txt -
call :check ".items[0].action" "auth.login.failed" "Audit filter - by action"
call :http 200 "Audit filter - this article" GET "/api/admin/audit?entityType=News&entityId=%NEWS_ID%" admin.txt -
call :check ".items[0].entityId" "%NEWS_ID%" "Audit filter - by entity"
call :check ".items.Count -ge 8" "True" "Audit - every news action was recorded"
call :http 200 "Audit filter - entry deleted" GET "/api/admin/audit?action=entry.deleted" admin.txt -
call :check ".totalCount -gt 0" "True" "Audit - entry deletion recorded"
call :http 400 "Audit filter - NUL character refused, not a 500" GET "/api/admin/audit?userEmail=%%%%00" admin.txt -
call :http 200 "Audit filter - email, case-insensitive" GET "/api/admin/audit?userEmail=ADMINTEST" admin.txt -
call :check ".totalCount -gt 0" "True" "Audit filter - finds admintest"

REM ==================================================================
call :wait 61
echo.
echo === 8. USER MANAGEMENT ===
call :http 401 "Users - not logged in" GET "/api/admin/users" - -
call :http 403 "Users - Editor is refused" GET "/api/admin/users" editor.txt -
call :http 200 "Users - Admin" GET "/api/admin/users" admin.txt -
call :http 200 "Users - search" GET "/api/admin/users?search=editortest" admin.txt -
call :check ".totalCount" "1" "Users - search finds exactly one"
call :http 400 "Users - NUL character in search refused, not a 500" GET "/api/admin/users?search=%%%%00" admin.txt -
call :http 403 "Create user - Editor is refused" POST "/api/admin/users" editor.txt user-create.json
call :http 400 "Create user - invalid role" POST "/api/admin/users" admin.txt user-badrole.json
call :http 400 "Create user - duplicate email" POST "/api/admin/users" admin.txt user-dup.json
call :http 400 "Create user - missing name" POST "/api/admin/users" admin.txt user-noname.json
call :http 201 "Create user - new Editor" POST "/api/admin/users" admin.txt user-create.json
call :json ".user.id"
set "TEMP_ID=%VAL%"
call :json ".temporaryPassword"
set "TEMP_PW=%VAL%"
call :check ".user.mustChangePassword" "True" "Create user - must change password"
call :check ".temporaryPassword.Length" "19" "Create user - temporary password has 16 characters + 3 dashes"
call :http 404 "Get user - unknown id" GET "/api/admin/users/00000000-0000-0000-0000-000000000000" admin.txt -

> login-temp.json     echo {"email":"%TEMP_EMAIL%","password":"%TEMP_PW%"}
> login-temp-new.json echo {"email":"%TEMP_EMAIL%","password":"Suite-New-Pass-2026"}
> pw-wrong.json       echo {"currentPassword":"Not-The-Password-2026","newPassword":"Suite-New-Pass-2026"}
> pw-same.json        echo {"currentPassword":"%TEMP_PW%","newPassword":"%TEMP_PW%"}
> pw-weak.json        echo {"currentPassword":"%TEMP_PW%","newPassword":"short"}
> pw-ok.json          echo {"currentPassword":"%TEMP_PW%","newPassword":"Suite-New-Pass-2026"}

call :http 200 "Login - new user with temporary password" POST "/api/auth/login" temp.txt login-temp.json
call :http 200 "Me - new user" GET "/api/auth/me" temp.txt -
call :check ".mustChangePassword" "True" "Me - password change required"
call :http 403 "Admin blocked until the password is changed" GET "/api/admin/news" temp.txt -
call :http 400 "Change password - wrong current password" POST "/api/auth/change-password" temp.txt pw-wrong.json
call :http 400 "Change password - same as current" POST "/api/auth/change-password" temp.txt pw-same.json
call :http 400 "Change password - too weak" POST "/api/auth/change-password" temp.txt pw-weak.json
call :http 204 "Change password - valid" POST "/api/auth/change-password" temp.txt pw-ok.json
call :http 200 "Admin unlocked after the password change" GET "/api/admin/news" temp.txt -
call :http 403 "New Editor cannot manage users" GET "/api/admin/users" temp.txt -

call :http 400 "Self-protection - cannot disable yourself" POST "/api/admin/users/%ADMIN_ID%/disable" admin.txt -
call :http 400 "Self-protection - cannot demote yourself" PUT "/api/admin/users/%ADMIN_ID%" admin.txt user-self-demote.json
call :http 400 "Self-protection - cannot force-logout yourself" POST "/api/admin/users/%ADMIN_ID%/force-logout" admin.txt -
call :http 400 "Self-protection - cannot reset your own password" POST "/api/admin/users/%ADMIN_ID%/reset-password" admin.txt -

call :http 200 "Change role - promote to Admin" PUT "/api/admin/users/%TEMP_ID%" admin.txt user-promote.json
call :check ".role" "Admin" "Change role - is now Admin"
call :http 200 "Change role - back to Editor" PUT "/api/admin/users/%TEMP_ID%" admin.txt user-demote.json
call :check ".role" "Editor" "Change role - is Editor again"

call :http 200 "Login - new user, own password" POST "/api/auth/login" temp.txt login-temp-new.json
call :http 200 "Disable user" POST "/api/admin/users/%TEMP_ID%/disable" admin.txt -
call :check ".isActive" "False" "Disable user - inactive"
call :wait 65
call :http 401 "Disabled user - open session ended" GET "/api/auth/me" temp.txt -
call :http 401 "Disabled user - cannot log in" POST "/api/auth/login" - login-temp-new.json
call :check ".detail" "Invalid email or password." "Disabled user - generic message only"
call :http 200 "Enable user" POST "/api/admin/users/%TEMP_ID%/enable" admin.txt -
call :http 200 "Enabled user - can log in again" POST "/api/auth/login" temp.txt login-temp-new.json
call :http 200 "Reset password" POST "/api/admin/users/%TEMP_ID%/reset-password" admin.txt -
call :json ".temporaryPassword"
set "TEMP_PW2=%VAL%"
call :check ".user.mustChangePassword" "True" "Reset password - must change again"
call :http 401 "Reset password - old password no longer works" POST "/api/auth/login" - login-temp-new.json
call :http 200 "Force logout" POST "/api/admin/users/%TEMP_ID%/force-logout" admin.txt -
call :http 200 "Unlock" POST "/api/admin/users/%TEMP_ID%/unlock" admin.txt -

echo.
echo --- Race: 10 identical "create user" requests at the same instant ---
set "U=%BASE%/api/admin/users"
curl -s -Z -b admin.txt -H "Content-Type: application/json" --data-binary @user-race.json -w "\nSTATUS_%%{http_code}\n" "%U%?n=1" "%U%?n=2" "%U%?n=3" "%U%?n=4" "%U%?n=5" "%U%?n=6" "%U%?n=7" "%U%?n=8" "%U%?n=9" "%U%?n=10" > race.out
set "R201=0"
set "R400=0"
set "R500=0"
for /f %%c in ('findstr /c:"STATUS_201" race.out ^| find /c /v ""') do set "R201=%%c"
for /f %%c in ('findstr /c:"STATUS_400" race.out ^| find /c /v ""') do set "R400=%%c"
for /f %%c in ('findstr /c:"STATUS_500" race.out ^| find /c /v ""') do set "R500=%%c"
if "%R201%-%R400%-%R500%"=="1-9-0" (
  set /a PASS+=1
  echo [PASS] Race - parallel creates: one created, nine refused, no 500
) else (
  set /a FAIL+=1
  echo [FAIL] Race - parallel creates  -- expected 1/9/0, got 201:%R201% 400:%R400% 500:%R500%
)
call :http 200 "Race - list users with that email" GET "/api/admin/users?search=%RACE_TAG%" admin.txt -
call :check ".totalCount" "1" "Race - exactly one user was created"
call :json ".items[0].id"
set "RACE_ID=%VAL%"

REM ==================================================================
call :wait 61
echo.
echo === 9. LOCKOUT - on the temporary user only ===
> login-temp-wrong.json echo {"email":"%TEMP_EMAIL%","password":"Wrong-Password-2026"}
> login-temp-reset.json echo {"email":"%TEMP_EMAIL%","password":"%TEMP_PW2%"}
call :http 401 "Lockout - wrong password 1 of 5" POST "/api/auth/login" - login-temp-wrong.json
call :http 401 "Lockout - wrong password 2 of 5" POST "/api/auth/login" - login-temp-wrong.json
call :http 401 "Lockout - wrong password 3 of 5" POST "/api/auth/login" - login-temp-wrong.json
call :http 401 "Lockout - wrong password 4 of 5" POST "/api/auth/login" - login-temp-wrong.json
call :http 429 "Lockout - 5th wrong password locks the account" POST "/api/auth/login" - login-temp-wrong.json
call :header "Retry-After" 1 "Lockout - Retry-After header present"
call :http 429 "Lockout - even the correct password is refused" POST "/api/auth/login" - login-temp-reset.json
call :http 200 "Users - account shown as locked" GET "/api/admin/users/%TEMP_ID%" admin.txt -
call :check ".isLockedOut" "True" "Users - isLockedOut is true"
call :http 200 "Unlock" POST "/api/admin/users/%TEMP_ID%/unlock" admin.txt -
call :http 200 "Unlocked - correct password works" POST "/api/auth/login" temp.txt login-temp-reset.json

call :wait 61
echo.
echo --- Race: 8 wrong passwords at the same instant, on the temporary user ---
set "L=%BASE%/api/auth/login"
curl -s -Z -H "Content-Type: application/json" --data-binary @login-temp-wrong.json -w "\nSTATUS_%%{http_code}\n" "%L%?n=1" "%L%?n=2" "%L%?n=3" "%L%?n=4" "%L%?n=5" "%L%?n=6" "%L%?n=7" "%L%?n=8" > race-login.out
set "R401=0"
set "R429=0"
set "R500=0"
for /f %%c in ('findstr /c:"STATUS_401" race-login.out ^| find /c /v ""') do set "R401=%%c"
for /f %%c in ('findstr /c:"STATUS_429" race-login.out ^| find /c /v ""') do set "R429=%%c"
for /f %%c in ('findstr /c:"STATUS_500" race-login.out ^| find /c /v ""') do set "R500=%%c"
if "%R401%-%R429%-%R500%"=="4-4-0" (
  set /a PASS+=1
  echo [PASS] Race - parallel wrong passwords: 4 refused, then locked, no 500
) else (
  set /a FAIL+=1
  echo [FAIL] Race - parallel wrong passwords  -- expected 401:4 429:4 500:0, got 401:%R401% 429:%R429% 500:%R500%
)
call :http 200 "Race - account is locked after parallel attempts" GET "/api/admin/users/%TEMP_ID%" admin.txt -
call :check ".isLockedOut" "True" "Race - isLockedOut is true"
call :http 429 "Race - correct password refused while locked" POST "/api/auth/login" - login-temp-reset.json
call :http 200 "Race - unlock" POST "/api/admin/users/%TEMP_ID%/unlock" admin.txt -

REM ==================================================================
call :wait 61
echo.
echo === 10. RATE LIMITING ===
set "GOT429=0"
for /L %%i in (1,1,12) do call :rlhit
if "%GOT429%"=="1" (
  set /a PASS+=1
  echo [PASS] Rate limit - rapid logins get 429
) else (
  set /a FAIL+=1
  echo [FAIL] Rate limit - 12 rapid logins never got 429
)
call :header "Retry-After" 1 "Rate limit - Retry-After header present"
call :http 200 "Rate limit - public site unaffected" GET "/api/news?lang=ar" - -

echo.
echo --- Upload rate limit on news covers ---
call :http 201 "Upload limit - create a draft" POST "/api/admin/news" admin.txt news-ok.json
call :json ".id"
set "UL_ID=%VAL%"
set "GOT429=0"
for /L %%i in (1,1,25) do call :ulhit
if "%GOT429%"=="1" (
  set /a PASS+=1
  echo [PASS] Upload limit - rapid news cover uploads get 429
) else (
  set /a FAIL+=1
  echo [FAIL] Upload limit - 25 rapid news cover uploads never got 429
)
call :http 204 "Upload limit - delete the draft and its cover" DELETE "/api/admin/news/%UL_ID%" admin.txt -

REM ==================================================================
echo.
echo === 11. CORS ===
call :cors "https://evil.example" 0 "CORS - other websites are refused"
call :cors "http://localhost:3000" 1 "CORS - the frontend is allowed"
call :header "Access-Control-Allow-Credentials: true" 1 "CORS - credentials allowed for the frontend"
curl -s -o out.json -D hdr.txt -H "Origin: http://localhost:3000" "%BASE%/api/news?lang=ar&pageSize=1"
call :header "Access-Control-Expose-Headers: Retry-After" 1 "CORS - Retry-After readable by the frontend"

echo.
echo --- Origin check: state-changing requests from other websites ---
call :origin 403 "Origin - another website cannot create news" "https://evil.example" POST "/api/admin/news" news-ok.json
call :origin 403 "Origin - a sandboxed page, Origin null, cannot create news" "null" POST "/api/admin/news" news-ok.json
call :origin 403 "Origin - another port on localhost cannot create news" "http://localhost:4444" POST "/api/admin/news" news-ok.json
call :origin 403 "Origin - another website cannot log out a user" "https://evil.example" POST "/api/auth/logout" -
call :origin 201 "Origin - the frontend itself can create news" "http://localhost:3000" POST "/api/admin/news" news-ok.json
call :json ".id"
set "OR_ID=%VAL%"
call :http 204 "Origin - delete that draft again" DELETE "/api/admin/news/%OR_ID%" admin.txt -
call :http 200 "Origin - GET from another website is not blocked, CORS hides it" GET "/api/news?lang=ar&pageSize=1" - -

REM ==================================================================
echo.
echo === 12. SECURITY HEADERS ===
call :http 200 "Headers - public response" GET "/api/news?lang=ar&pageSize=1" - -
call :header "X-Content-Type-Options: nosniff" 1 "Headers - nosniff"
call :header "X-Frame-Options: DENY" 1 "Headers - no framing"
call :header "Referrer-Policy: no-referrer" 1 "Headers - no referrer"
call :header "Permissions-Policy:" 1 "Headers - permissions policy"
call :header "Content-Security-Policy: default-src 'none'" 1 "Headers - content security policy"
call :header "Server:" 0 "Headers - no Server header"
call :header "Strict-Transport-Security" 0 "Headers - no HSTS in Development"
call :header "no-store" 0 "Headers - public data may be cached"
call :http 404 "Headers - error response" GET "/api/news/this-does-not-exist" - -
call :header "X-Content-Type-Options: nosniff" 1 "Headers - present on errors too"
call :http 200 "Headers - admin response" GET "/api/admin/news?pageSize=1" admin.txt -
call :header "no-store" 1 "Headers - admin data never cached"
call :http 200 "Headers - audit response" GET "/api/admin/audit?pageSize=1" admin.txt -
call :header "no-store" 1 "Headers - audit data never cached"

REM ==================================================================
echo.
echo === CLEANUP AND DATABASE CHECKS ===
call :http 200 "Cleanup - archive the suite article" POST "/api/admin/news/%NEWS_ID%/archive" admin.txt -
call :http 200 "Cleanup - disable the suite user" POST "/api/admin/users/%TEMP_ID%/disable" admin.txt -
if not "%RACE_ID%"=="" if not "%RACE_ID%"=="null" call :http 200 "Cleanup - disable the race user" POST "/api/admin/users/%RACE_ID%/disable" admin.txt -

call :countfiles
if "%FILES%"=="%FILES_BEFORE%" (
  set /a PASS+=1
  echo [PASS] Database - no orphan photos, %FILES% stored files before and after the suite
) else (
  set /a FAIL+=1
  echo [FAIL] Database - orphan photos: %FILES_BEFORE% stored files before the suite, %FILES% after
)

set "DPK=0"
for /f "usebackq" %%n in (`docker exec bshatfine-db psql -U bshatfine_user -d bshatfine -t -A -c "SELECT count(*) FROM \"DataProtectionKeys\";"`) do set "DPK=%%n"
if %DPK% GEQ 1 (
  set /a PASS+=1
  echo [PASS] Database - Data Protection keys stored in PostgreSQL, %DPK% key
) else (
  set /a FAIL+=1
  echo [FAIL] Database - no Data Protection key in PostgreSQL
)

call :http 204 "Cleanup - logout Admin" POST "/api/auth/logout" admin.txt -
call :http 204 "Cleanup - logout Editor" POST "/api/auth/logout" editor.txt -

:end
echo.
echo ==================================================
echo   RESULT: %PASS% passed, %FAIL% failed
echo   Suite users: %TEMP_EMAIL% and %RACE_EMAIL% - disabled
echo ==================================================
popd
rmdir /s /q "%WORK%" 2>nul
endlocal
exit /b

REM ==================================================================
REM  Helpers
REM ==================================================================

:http
REM %1 expected  %2 name  %3 method  %4 path  %5 cookie jar or -  %6 json body file or -
set "CODE=000"
set "ARGS=-s -o out.json -D hdr.txt -w %%{http_code} -X %~3"
if not "%~5"=="-" set "ARGS=%ARGS% -b %~5 -c %~5"
if not "%~6"=="-" set "ARGS=%ARGS% -H "Content-Type: application/json" --data-binary @%~6"
for /f "usebackq" %%c in (`curl %ARGS% "%BASE%%~4"`) do set "CODE=%%c"
call :verdict "%~1" "%~2" ""
exit /b

:upload
REM %1 expected  %2 name  %3 cookie jar  %4 form field  %5 file  %6 upload path  %7 optional alternative code
set "CODE=000"
for /f "usebackq" %%c in (`curl -s -o out.json -D hdr.txt -w "%%{http_code}" -X POST -b %~3 -c %~3 -F "%~4=@%~5" "%BASE%%~6"`) do set "CODE=%%c"
call :verdict "%~1" "%~2" "%~7"
exit /b

:getver
REM %1 path  %2 cookie jar  -> sets VER to the record's current version
curl -s -o out.json -b %~2 -c %~2 "%BASE%%~1"
call :json ".version"
set "VER=%VAL%"
exit /b

:verdict
set "OK=0"
if "%CODE%"=="%~1" set "OK=1"
if not "%~3"=="" if "%CODE%"=="%~3" set "OK=1"
if "%OK%"=="1" (
  set /a PASS+=1
  echo [PASS] %~2
) else (
  set /a FAIL+=1
  echo [FAIL] %~2  -- expected %~1, got %CODE%
  if exist out.json type out.json
  echo.
)
exit /b

:json
set "VAL="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "try { $j = Get-Content -Raw out.json | ConvertFrom-Json; $v = $j%~1; if ($null -eq $v) { 'null' } else { $v } } catch { 'invalid' }"`) do set "VAL=%%v"
exit /b

:check
call :json "%~1"
if /i "%VAL%"=="%~2" (
  set /a PASS+=1
  echo [PASS] %~3
) else (
  set /a FAIL+=1
  echo [FAIL] %~3  -- expected %~2, got %VAL%
)
exit /b

:header
findstr /i /c:"%~1" hdr.txt >nul
if errorlevel 1 (set "H=0") else (set "H=1")
if "%H%"=="%~2" (
  set /a PASS+=1
  echo [PASS] %~3
) else (
  set /a FAIL+=1
  echo [FAIL] %~3
)
exit /b

:nosecret
findstr /c:"%ADMIN_PASS%" /c:"%EDITOR_PASS%" /c:"Wrong-Password-2026" out.json >nul
if errorlevel 1 (
  set /a PASS+=1
  echo [PASS] %~1
) else (
  set /a FAIL+=1
  echo [FAIL] %~1  -- a password was found in the response
)
exit /b

:cors
for /f "usebackq" %%c in (`curl -s -o out.json -D hdr.txt -w "%%{http_code}" -X OPTIONS -H "Origin: %~1" -H "Access-Control-Request-Method: POST" "%BASE%/api/admin/news"`) do set "CODE=%%c"
call :header "Access-Control-Allow-Origin: %~1" %~2 "%~3"
exit /b

:rlhit
set "RC=000"
for /f "usebackq" %%c in (`curl -s -o out.json -D hdr.txt -w "%%{http_code}" -X POST -H "Content-Type: application/json" --data-binary @login-unknown.json "%BASE%/api/auth/login"`) do set "RC=%%c"
if "%RC%"=="429" set "GOT429=1"
exit /b

:origin
REM %1 expected  %2 name  %3 Origin header  %4 method  %5 path  %6 json body file or -   (always as the test Admin)
set "CODE=000"
if "%~6"=="-" (
  for /f "usebackq" %%c in (`curl -s -o out.json -D hdr.txt -w "%%{http_code}" -X %~4 -b admin.txt -c admin.txt -H "Origin: %~3" "%BASE%%~5"`) do set "CODE=%%c"
) else (
  for /f "usebackq" %%c in (`curl -s -o out.json -D hdr.txt -w "%%{http_code}" -X %~4 -b admin.txt -c admin.txt -H "Origin: %~3" -H "Content-Type: application/json" --data-binary @%~6 "%BASE%%~5"`) do set "CODE=%%c"
)
call :verdict "%~1" "%~2" ""
exit /b

:ulhit
if "%GOT429%"=="1" exit /b
set "RC=000"
for /f "usebackq" %%c in (`curl -s -o out.json -w "%%{http_code}" -X POST -b admin.txt -F "file=@%IMG%" "%BASE%/api/admin/news/%UL_ID%/cover"`) do set "RC=%%c"
if "%RC%"=="429" set "GOT429=1"
exit /b

:countfiles
set "FILES=?"
for /f "usebackq" %%n in (`docker exec bshatfine-db psql -U bshatfine_user -d bshatfine -t -A -c "SELECT count(*) FROM \"StoredFiles\";"`) do set "FILES=%%n"
exit /b

:wait
echo.
echo   ...waiting %~1 seconds so the login rate limit resets...
timeout /t %~1 /nobreak >nul
exit /b
