#include <stdio.h>

void stepIn() {
    printf("If you see this after step\n");
    printf("in, you failed\n");
}

unsigned char test_step_in_main(void) {
    stepIn();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}