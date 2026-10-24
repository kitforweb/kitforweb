export interface LibraryPattern {
  id: string;
  source: string;
  flags: string;
  valid: string[];
  invalid: string[];
}

/**
 * Ready-made patterns. Each one is pragmatic, not exhaustive: validation of
 * emails, IBANs or ID numbers must also be done on the server.
 */
export const libraryPatterns: LibraryPattern[] = [
  {
    id: "email",
    source: "^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)*\\.[A-Za-z]{2,}$",
    flags: "",
    valid: ["ada@example.com", "first.last+tag@sub.example.co.uk"],
    invalid: ["ada@", "ada@example", "@example.com", "ada example@x.com"],
  },
  {
    id: "url",
    source: "^https?:\\/\\/[\\w-]+(\\.[\\w-]+)+(:\\d{1,5})?(\\/[^\\s]*)?$",
    flags: "i",
    valid: ["https://example.com", "http://sub.example.com:8080/path?q=1#x"],
    invalid: ["ftp://example.com", "https://", "example.com", "https://exa mple.com"],
  },
  {
    id: "dni",
    source: "^\\d{8}[A-HJ-NP-TV-Z]$",
    flags: "i",
    valid: ["12345678Z", "00000000t"],
    invalid: ["1234567Z", "12345678U", "ABCDEFGHZ"],
  },
  {
    id: "nie",
    source: "^[XYZ]\\d{7}[A-HJ-NP-TV-Z]$",
    flags: "i",
    valid: ["X1234567L", "Y0000000Z"],
    invalid: ["A1234567L", "X123456L", "X1234567U"],
  },
  {
    id: "iban",
    source: "^[A-Z]{2}\\d{2}( ?[A-Z0-9]{4}){2,7}( ?[A-Z0-9]{1,4})?$",
    flags: "",
    valid: ["ES9121000418450200051332", "ES91 2100 0418 4502 0005 1332", "DE89370400440532013000"],
    invalid: ["ES91", "9121000418450200051332", "es9121000418450200051332"],
  },
  {
    id: "phone-intl",
    source: "^\\+[1-9]\\d{6,14}$",
    flags: "",
    valid: ["+34612345678", "+14155552671"],
    invalid: ["612345678", "+0123456789", "+34 612 345 678"],
  },
  {
    id: "phone-es",
    source: "^(\\+34|0034)?[ -]?[6789]\\d{2}[ -]?\\d{3}[ -]?\\d{3}$",
    flags: "",
    valid: ["612345678", "+34 612 345 678", "912-345-678"],
    invalid: ["512345678", "61234567", "+33612345678"],
  },
  {
    id: "postal-es",
    source: "^(0[1-9]|[1-4]\\d|5[0-2])\\d{3}$",
    flags: "",
    valid: ["28001", "08080", "52006"],
    invalid: ["00123", "53000", "2800", "280011"],
  },
  {
    id: "password",
    source: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{12,}$",
    flags: "",
    valid: ["Str0ng!Passw0rd", "Aa1!aaaaaaaa"],
    invalid: ["short1!A", "alllowercase1!", "NoDigitsHere!!", "NoSymbols1234"],
  },
  {
    id: "date-iso",
    source: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$",
    flags: "",
    valid: ["2024-02-29", "1999-12-31"],
    invalid: ["2024-13-01", "2024-00-10", "24-01-01", "2024-1-1"],
  },
  {
    id: "date-eu",
    source: "^(0[1-9]|[12]\\d|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4}$",
    flags: "",
    valid: ["31/12/2024", "01/01/2000"],
    invalid: ["32/01/2024", "1/1/2024", "2024/01/01"],
  },
  {
    id: "time",
    source: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$",
    flags: "",
    valid: ["09:30", "23:59:59", "00:00"],
    invalid: ["24:00", "9:30", "12:60"],
  },
  {
    id: "hex-color",
    source: "^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$",
    flags: "i",
    valid: ["#fff", "#00FFAA", "#0ff8", "#11223344"],
    invalid: ["fff", "#ggg", "#12345"],
  },
  {
    id: "ipv4",
    source: "^((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$",
    flags: "",
    valid: ["192.168.1.1", "10.0.0.255", "0.0.0.0"],
    invalid: ["256.1.1.1", "192.168.1", "01.1.1.1"],
  },
  {
    id: "slug",
    source: "^[a-z0-9]+(-[a-z0-9]+)*$",
    flags: "",
    valid: ["hello-world", "kitforweb", "post-2024"],
    invalid: ["Hello-World", "hello--world", "-hello", "hello_world"],
  },
  {
    id: "uuid",
    source: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    flags: "i",
    valid: ["0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d", "C232AB00-9414-11EC-B3C8-9E6BDECED846"],
    invalid: ["0190a5b8-6e1f-0c3a-9b2d-4e5f6a7b8c9d", "not-a-uuid"],
  },
  {
    id: "username",
    source: "^[a-zA-Z][a-zA-Z0-9_]{2,15}$",
    flags: "",
    valid: ["ada", "ada_lovelace", "User123"],
    invalid: ["ab", "1ada", "ada-lovelace", "a_very_long_username_here"],
  },
];
