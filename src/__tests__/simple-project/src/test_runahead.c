#include <conio.h>

#ifdef __C64__
#include <stdio.h>
#endif

void step_runahead() {
    // This is to test runahead through functions
#ifdef __C64__
    FILE* f;
#endif
    unsigned char yes[4] = "yes";

    cputs("If you see this after step\n");
    cputs("in, you failed\n");

#ifdef __C64__
    f = fopen("abcdef0123456789", "wb");
    if(!f) {
        while(1);
    }

    fwrite("yes", 3, 1, f);

    fclose(f);

    f = fopen("abcdef0123456789", "wb");
    if(!f) {
        while(1);
    }

    fread(yes, 3, 1, f);

    fclose(f);
#endif
}

void step_breakpoint(void) {
    cputs("Another function\n");
}

unsigned char test_runahead_main(void) {
    step_runahead();
    step_breakpoint();
    cputs("If you see this after step\n");
    cputs("out, you failed\n");
    return 0;
}