#include <stdio.h>

void step_pet() {
    printf("If you see this after step\n");
    printf("in, you failed\n");
}

unsigned char test_non_c64_main(void) {
    step_pet();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}