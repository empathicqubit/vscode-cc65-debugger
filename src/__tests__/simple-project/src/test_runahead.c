#include <stdio.h>

void step_runahead() {
    // This is to test runahead through functions
    FILE* f;
    unsigned char yes[4] = "yes";

    printf("If you see this after step\n");
    printf("in, you failed\n");

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
}

void step_breakpoint(void) {
    printf("Another function\n");
}

unsigned char test_runahead_main(void) {
    step_runahead();
    step_breakpoint();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}