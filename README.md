# NL Holidays & School Vacations iCal


Hollanda resmi tatiller ve okul tatilleri için otomatik güncellenen ICS abonelikleri.


## Abone Olma (Google Calendar)
- Google Calendar > Other calendars (+) > From URL
- Aşağıdaki URL’lerden birini yapıştırın (GitHub Pages deploy adresiniz):
- https://<username>.github.io/<repo>/nl-public-holidays.ics
- https://<username>.github.io/<repo>/nl-school-north.ics
- https://<username>.github.io/<repo>/nl-school-central.ics
- https://<username>.github.io/<repo>/nl-school-south.ics
- https://<username>.github.io/<repo>/nl-school-all.ics
- https://<username>.github.io/<repo>/nl-all-in-one.ics


## Abone Olma (Apple Calendar / Mac)
- Calendar > File > New Calendar Subscription
- URL’yi girin ve “iCloud” konumunu seçin.


## Geliştirme
- `yarn` ile bağımlılıkları kurun.
- `yarn build` üretir; ICS’ler `dist/` altında.
- GitHub Actions haftalık olarak `docs/`’u günceller.


## Doğruluk & Kapsam
- Okul tatilleri Rijksoverheid Open Data’dan düzenli olarak çekilir.
- Resmi tatiller kural tabanlı olarak üretilir (Paskalya vb. hareketli tarih hesaplamaları).


## Lisans
MIT