function main() {
    /* 버퍼에서 읽기 */
    const buffer = "Hello, World!";
    printDocument(buffer);

    /* 파일에서 읽기 */
    const file = new File("test.txt");
    printDocument(file);
    file.close();
}

function printDocument(doc: string | File) {
    /* 버퍼에서 읽기 */
    if (typeof doc === "string") {
        for (let i = 0; i < doc.length; i++) {
            const char = doc.charAt(i);

            console.log(char);
        }
    } else if (doc instanceof File) {
        /* 파일에서 읽기 */
        let char = doc.getChar();

        while (char != EOF) {
            console.log(char);

            char = doc.getChar();
        }
    }
}
