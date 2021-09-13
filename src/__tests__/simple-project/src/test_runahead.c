#include <stdio.h>

void step_runahead() {
    printf("If you see this after step\n");
    printf("in, you failed\n");
}

unsigned char test_runahead_main(void) {
    step_runahead();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}