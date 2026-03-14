dept_codes = {
    "AIML": 148,
    "IT": 205,
}

subject_credit_mapping = {
    # Sem 7 subjects
    "GE3791": 2,
    "AI3021": 3,
    "CCS355": 3,
    "CCS374": 3,
    "GE3752": 3,
    "IT3711": 3,
    "OHS352": 3,
    "SB8067": 3,
    # Sem 5 subjects
    "CS3591": 4,
    "IT3501": 3,
    "CS3551": 3,
    "CS3691": 4,
    "CCS334": 3,
    "CCS335": 3,
    "CCS366": 3,
    "CCS360": 3,
    "MX3084": 0,  # Non credit course
    "IT3511": 2,
    "NM1120": 0,  # 2 credits (currently disabled)
    # Sem 4 subjects
    "CS3451": 3,
    "CS3452": 3,
    "CS3461": 1.5,
    "CS3481": 1.5,
    "CS3491": 4,
    "CS3492": 3,
    "GE3451": 2,
    "IT3401": 4,
    # Disable the naan mudhalvan by setting credits to 0
    "NM1075": 0,  # 2 credits (currently disabled)
    "MA3354": 4,
    "CS3351": 4,
    "CS3352": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 2,
    "CS3381": 1.5,
    "CS3361": 2,
    "GE3361": 1,
}

subject_sem_mapping = {
    # Sem 7 subjects
    "GE3791": 7,
    "AI3021": 7,
    "CCS355": 7,
    "CCS374": 7,
    "GE3752": 7,
    "IT3711": 7,
    "OHS352": 7,
    "SB8067": 7,
    # Sem 5 subjects
    "CS3591": 5,
    "IT3501": 5,
    "CS3551": 5,
    "CS3691": 5,
    "CCS334": 5,
    "CCS335": 5,
    "CCS366": 5,
    "CCS360": 5,
    "MX3084": 5,
    "IT3511": 5,
    "NM1120": 5,
    # Sem 4 subjects
    "CS3451": 4,
    "CS3452": 4,
    "CS3491": 4,
    "CS3492": 4,
    "GE3451": 4,
    "IT3401": 4,
    "CS3481": 4,
    "CS3461": 4,
    "NM1075": 4,
    # Sem 3 subjects
    "CS3351": 3,
    "CS3352": 3,
    "MA3354": 3,
    "CD3291": 3,
    "CS3391": 3,
    "CD3281": 3,
    "CS3381": 3,
    "CS3361": 3,
    "GE3361": 3,
    "NM1113": 0,  # 2 credits (currently disabled)
}

grade_mapping = {
    "O": 10,
    "A+": 9,
    "A": 8,
    "B+": 7,
    "B": 6,
    "C": 5,
    "U": 0,  # Reappear
    "UA": 0,  # Not Attempted
    "NA": 0,  # Not Available
}


def calculate_sgpa(semester: int, grades: dict, all_subs: bool = False) -> float:
    if not (2 < semester < 9):
        raise ValueError("Semester must be between 3 and 8 inclusive.")

    # get subjects from semester_mapping
    subjects = (
        [
            sub for sub, res in grades.items() if res != "NA"
        ]  # ignore subjects with NA grade (Not Available)
        if not all_subs
        else [sub for sub, sem in subject_sem_mapping.items() if sem == semester]
    )
    print(subjects)
    credits = [subject_credit_mapping[sub] for sub in subjects]

    gps = []
    for subject in subjects:
        grade = grades.get(subject, "U")
        gp = grade_mapping[grade]
        gps.append(gp * credits[subjects.index(subject)])

    total_credits = sum(credits)
    total_gp = sum(gps)

    return total_gp / total_credits


def get_subjects_for_semester(semester: int) -> list[str]:
    return [sub for sub, sem in subject_sem_mapping.items() if sem == semester]
